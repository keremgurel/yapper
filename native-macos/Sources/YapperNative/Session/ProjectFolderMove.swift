import Foundation

/// Points editor projects at a new folder and brings the existing ones along,
/// one package at a time, with progress the Storage page shows.
///
/// The open project is saved and closed before anything moves, so nothing
/// writes into a package while it is being copied, and it reopens from its
/// new place afterwards.
@MainActor
final class ProjectFolderMove: ObservableObject {
    static let shared = ProjectFolderMove()

    struct Progress: Equatable {
        let done: Int
        let total: Int
        let name: String
    }

    @Published private(set) var progress: Progress?
    /// What the last move did, in a sentence or two.
    @Published private(set) var outcome: String?

    var isRunning: Bool { progress != nil }

    /// Why a move can't start now, or nil when it can.
    func blocker(for session: EditorSession) -> String? {
        if isRunning { return "Projects are already moving." }
        if session.isBusy { return "Wait for the current task in the editor to finish, then move your projects." }
        return nil
    }

    /// `folder` nil means the default folder.
    func moveProjects(choosing folder: URL?, moving packages: [ProjectPackage], session: EditorSession,
             folders: StorageFolders = .standard) async {
        if let blocker = blocker(for: session) { outcome = blocker; return }
        outcome = nil
        progress = Progress(done: 0, total: packages.count, name: packages.first?.displayName ?? "")
        defer { progress = nil }

        if let reason = await uploadBlocker(packages) { outcome = reason; return }
        var reopen: ProjectPackage?
        if let open = session.projectNavigation.currentPackage, packages.contains(open) {
            reopen = await session.closeCurrentProject()
        }
        await session.stopManagedMedia()

        if let folder { folders.choose(folder, for: .editorProjects) } else { folders.useDefault(for: .editorProjects) }
        let destination: URL
        do {
            destination = try folders.usableFolder(for: .editorProjects)
        } catch {
            outcome = error.localizedDescription
            return
        }

        var moved: [ProjectMover.Moved] = []
        var failures: [String] = []
        for (index, package) in packages.enumerated() {
            progress = Progress(done: index, total: packages.count, name: package.displayName)
            do {
                let result = try await Task.detached(priority: .userInitiated) {
                    try ProjectMover.move(package, into: destination)
                }.value
                RecentProjects.replace(result.from, with: result.to)
                await ProjectPosterLoader.shared.invalidate(package)
                moved.append(result)
            } catch {
                failures.append("“\(package.displayName)”: \(error.localizedDescription)")
            }
        }
        session.projectNavigation.noteLibraryChanged()
        NativeAnalytics.shared.capture("native_projects_moved", ["moved": moved.count, "failed": failures.count])

        if let reopen {
            let next = moved.first(where: { ProjectPackage(url: $0.from) == reopen }).map { ProjectPackage(url: $0.to) } ?? reopen
            await session.openProject(next)
        }
        outcome = Self.summary(moved: moved, failures: failures, folder: destination)
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

    static func summary(moved: [ProjectMover.Moved], failures: [String], folder: URL) -> String {
        var parts: [String] = []
        if !moved.isEmpty {
            let count = moved.count == 1 ? "1 project" : "\(moved.count) projects"
            parts.append("Moved \(count) to “\(folder.lastPathComponent)”.")
        }
        if moved.contains(where: \.originalInTrash) {
            parts.append("The originals are in the Trash. Empty it to free the space.")
        }
        if moved.contains(where: \.originalKept) {
            parts.append("Some originals couldn’t go to the Trash, so they’re still in the old folder.")
        }
        if !failures.isEmpty {
            parts.append("Not moved, still in the old folder: " + failures.joined(separator: " "))
        }
        return parts.joined(separator: " ")
    }
}
