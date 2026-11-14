import Foundation

/// Brings the existing projects to a new projects folder, one package at a
/// time, with progress the Storage page shows.
///
/// The order is what keeps work safe. The destination is readied before
/// anything closes. The open project is saved, and a failed save stops the
/// move. Nothing can open, make or change a project until the move ends. The
/// setting switches only once at least one project is in the new folder, and
/// any that couldn't move are kept by path so Try again can still reach them.
@MainActor
final class ProjectFolderMove: ObservableObject {
    static let shared = ProjectFolderMove()

    typealias MoveOne = @Sendable (ProjectPackage, URL) throws -> ProjectMover.Moved?

    struct Progress: Equatable {
        let done: Int
        let total: Int
        let name: String
    }

    /// Projects a move couldn't take, and the folder they were going to.
    struct LeftBehind: Equatable {
        let packages: [ProjectPackage]
        /// Nil means the default folder.
        let folder: URL?
    }

    @Published private(set) var progress: Progress?
    /// What the last move did, in a sentence or two.
    @Published private(set) var outcome: String?
    @Published private(set) var leftBehind: LeftBehind?

    private let moveOne: MoveOne

    /// `moveOne` lets tests fail a chosen package.
    init(moveOne: @escaping MoveOne = { try ProjectMover.move($0, into: $1) }) {
        self.moveOne = moveOne
    }

    var isRunning: Bool { progress != nil }

    /// Why a move can't start now, or nil when it can. An export only reads
    /// a project's own files while it prepares; after that it renders from
    /// its own copy and the project can move.
    func blocker(for session: EditorSession, moving packages: [ProjectPackage]) async -> String? {
        if let reason = startBlocker(for: session) { return reason }
        return await exportBlocker(packages, session: session)
    }

    /// The checks that need no waiting, so a second move can't slip in
    /// between passing them and taking the lock.
    private func startBlocker(for session: EditorSession) -> String? {
        if isRunning || session.projectNavigation.isMovingProjects { return "Projects are already moving." }
        if session.isBusy {
            return "Wait for the current task in the editor to finish, then move your projects."
        }
        return nil
    }

    /// `folder` nil means the default folder.
    func moveProjects(choosing folder: URL?, moving packages: [ProjectPackage], session: EditorSession,
                      folders: StorageFolders = .standard) async {
        if let blocker = startBlocker(for: session) { outcome = blocker; return }
        outcome = nil
        leftBehind = nil
        progress = Progress(done: 0, total: packages.count, name: packages.first?.displayName ?? "")
        session.projectNavigation.isMovingProjects = true
        var reopen: ProjectPackage?
        var moved: [ProjectMover.Moved] = []
        var failures: [ProjectPackage: String] = [:]
        var destination: URL?
        var ranMoves = false

        defer { progress = nil }
        do {
            let target = try folders.usableFolder(folder, for: .editorProjects)
            destination = target
            if let reason = await exportBlocker(packages, session: session) { throw ProjectMoveStop(reason) }
            if let reason = await uploadBlocker(packages) { throw ProjectMoveStop(reason) }
            reopen = try await closeIfMoving(packages, session: session)
            // Asked again: the checks above awaited with the project still
            // open, and an export of it may have started in the meantime.
            if let reason = await exportBlocker(packages, session: session) { throw ProjectMoveStop(reason) }
            await session.stopManagedMedia()
            ProjectMoveStaging.sweep(in: target)
            ProjectMoveStaging.noteMoving(into: target, preferences: folders.preferences)
            for (index, package) in packages.enumerated() {
                progress = Progress(done: index, total: packages.count, name: package.displayName)
                do {
                    let moveOne = moveOne
                    let result = try await Task.detached(priority: .userInitiated) { try moveOne(package, target) }.value
                    guard let result else { continue }
                    RecentProjects.replace(result.from, with: result.to)
                    await ProjectPosterLoader.shared.invalidate(package)
                    moved.append(result)
                } catch {
                    failures[package] = error.localizedDescription
                }
            }
            ProjectMoveStaging.noteMoving(into: nil, preferences: folders.preferences)
            ranMoves = true
        } catch {
            outcome = error.localizedDescription
        }

        if !moved.isEmpty || (ranMoves && failures.isEmpty) {
            if let folder { folders.choose(folder, for: .editorProjects) } else { folders.useDefault(for: .editorProjects) }
        }
        let stuck = packages.filter { failures[$0] != nil }
        if !stuck.isEmpty { leftBehind = LeftBehind(packages: stuck, folder: folder) }
        session.projectNavigation.isMovingProjects = false
        session.projectNavigation.noteLibraryChanged()
        if !moved.isEmpty || !failures.isEmpty {
            NativeAnalytics.shared.capture("native_projects_moved", ["moved": moved.count, "failed": failures.count])
        }

        if let reopen {
            let next = moved.first(where: { ProjectPackage(url: $0.from) == reopen }).map { ProjectPackage(url: $0.to) } ?? reopen
            await session.openProject(next)
        }
        if ranMoves, let destination {
            let sentence = ProjectMoveSummary.sentence(
                moved: moved,
                failures: stuck.compactMap { package in failures[package].map { "“\(package.displayName)”: \($0)" } },
                folder: destination
            )
            outcome = sentence.isEmpty ? nil : sentence
        }
    }

    /// Moves the projects the last move couldn't, to the folder it was taking
    /// them to. They are found by path, so it works whether or not the setting
    /// has switched.
    func retryLeftBehind(session: EditorSession, folders: StorageFolders = .standard) async {
        guard let leftBehind else { return }
        let packages = leftBehind.packages.filter { FileManager.default.fileExists(atPath: $0.url.path) }
        await moveProjects(choosing: leftBehind.folder, moving: packages, session: session, folders: folders)
    }

    /// Saves and closes the open project when it is one of those moving. A
    /// save that fails stops the move rather than leave edits behind.
    private func closeIfMoving(_ packages: [ProjectPackage], session: EditorSession) async throws -> ProjectPackage? {
        guard let open = session.projectNavigation.currentPackage, packages.contains(open) else { return nil }
        do {
            try await session.persist()
        } catch {
            throw ProjectMoveStop("“\(open.displayName)” couldn’t be saved, so nothing was moved. \(error.localizedDescription)")
        }
        return await session.closeCurrentProject()
    }

    /// Exports know projects by ID, so each package is asked which project
    /// it holds. Skipped when no export is preparing, which is nearly always.
    private func exportBlocker(_ packages: [ProjectPackage], session: EditorSession) async -> String? {
        guard session.exportJobs.jobs.contains(where: { $0.state == .preparing }) else { return nil }
        for package in packages {
            guard let projectID = await session.projectID(in: package),
                  session.exportJobs.isReadingSources(projectID: projectID)
            else { continue }
            return "Wait for the export of “\(package.displayName)” to finish preparing its footage, then move your projects."
        }
        return nil
    }

    private func uploadBlocker(_ packages: [ProjectPackage]) async -> String? {
        let listings = (try? await ProjectLibrary.shared.listings()) ?? []
        for listing in listings where packages.contains(listing.package) {
            if PosterProjectSync.shared.isUploading(projectID: listing.summary.id) {
                return "Wait for “\(listing.package.displayName)” to finish uploading, then move your projects."
            }
        }
        return nil
    }
}

/// A reason a move stopped before any project moved.
private struct ProjectMoveStop: LocalizedError {
    let reason: String
    init(_ reason: String) { self.reason = reason }
    var errorDescription: String? { reason }
}
