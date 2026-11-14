import Foundation
import Testing
@testable import YapperNative

/// Moving every project to a new folder, through the editor: what closes and
/// reopens, when the setting switches, and what a failure leaves.
@MainActor
@Suite(.serialized)
struct ProjectFolderMoveTests {
    private final class FailSwitch: @unchecked Sendable {
        var failing: Set<String>
        init(_ failing: Set<String>) { self.failing = failing }
    }

    private struct Rig {
        let root: URL
        let folders: StorageFolders
        let old: URL
        let new: URL
        let session: EditorSession
        let first: ProjectPackage
        let second: ProjectPackage
    }

    private func rig() async throws -> Rig {
        let root = FileManager.default.temporaryDirectory
            .appending(path: "ProjectFolderMoveTests-\(UUID().uuidString)", directoryHint: .isDirectory)
        let folders = StorageFolders(
            preferences: MemoryStoragePreferences(),
            movies: root.appending(path: "Movies", directoryHint: .isDirectory),
            downloads: root.appending(path: "Downloads", directoryHint: .isDirectory)
        )
        let old = try folders.usableFolder(for: .editorProjects)
        let new = root.appending(path: "Drive/Projects", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: new, withIntermediateDirectories: true)
        let library = ProjectLibrary(directory: old)
        let first = try await library.create(named: "Day 25")
        let second = try await library.create(named: "Day 26")
        let session = EditorSession(store: ProjectStore(directory: root.appending(path: "session", directoryHint: .isDirectory)))
        await Task.yield()
        await session.openProject(second)
        await session.openProject(first)
        return Rig(root: root, folders: folders, old: old, new: new, session: session, first: first, second: second)
    }

    private func mover(failing names: FailSwitch) -> ProjectFolderMove {
        ProjectFolderMove { package, folder in
            if names.failing.contains(package.displayName) { throw CocoaError(.fileWriteOutOfSpace) }
            return try ProjectMover.move(package, into: folder)
        }
    }

    private func packages(in folder: URL) throws -> [String] {
        try FileManager.default.contentsOfDirectory(atPath: folder.path).filter { $0.hasSuffix(".yapperproj") }.sorted()
    }

    private func isIn(_ package: ProjectPackage?, _ folder: URL) -> Bool {
        guard let package else { return false }
        return FolderIdentity.same(package.url.deletingLastPathComponent(), folder)
    }

    @Test("The open project is saved, closed, moved and reopened from the new folder, then the setting switches")
    func closesMovesAndReopens() async throws {
        let rig = try await rig()
        defer { try? FileManager.default.removeItem(at: rig.root) }
        let move = ProjectFolderMove()
        await move.moveProjects(choosing: rig.new, moving: [rig.first, rig.second], session: rig.session, folders: rig.folders)

        #expect(try packages(in: rig.old).isEmpty)
        #expect(try packages(in: rig.new) == ["Day 25.yapperproj", "Day 26.yapperproj"])
        #expect(rig.folders.chosen(.editorProjects).map { FolderIdentity.same($0, rig.new) } == true)
        #expect(isIn(rig.session.projectNavigation.currentPackage, rig.new))
        #expect(rig.session.project.name == "Day 25")
        #expect(!rig.session.projectNavigation.isMovingProjects)
        #expect(move.leftBehind == nil)
        #expect(move.outcome?.contains("Moved 2 projects") == true)
    }

    @Test("A project that can't move stays where it was, and Try again takes it by path after the setting switched")
    func partialFailureCanBeRetried() async throws {
        let rig = try await rig()
        defer { try? FileManager.default.removeItem(at: rig.root) }
        let failing = FailSwitch(["Day 26"])
        let move = mover(failing: failing)
        await move.moveProjects(choosing: rig.new, moving: [rig.first, rig.second], session: rig.session, folders: rig.folders)

        #expect(try packages(in: rig.old) == ["Day 26.yapperproj"])
        #expect(try packages(in: rig.new) == ["Day 25.yapperproj"])
        #expect(rig.folders.chosen(.editorProjects) != nil)
        #expect(move.leftBehind?.packages == [rig.second])
        #expect(move.outcome?.contains("Not moved") == true)

        failing.failing = []
        await move.retryLeftBehind(session: rig.session, folders: rig.folders)
        #expect(try packages(in: rig.old).isEmpty)
        #expect(try packages(in: rig.new) == ["Day 25.yapperproj", "Day 26.yapperproj"])
        #expect(move.leftBehind == nil)
    }

    @Test("When nothing moves the setting stays, and the open project reopens where it was")
    func nothingMovedKeepsTheSetting() async throws {
        let rig = try await rig()
        defer { try? FileManager.default.removeItem(at: rig.root) }
        let move = mover(failing: FailSwitch(["Day 25", "Day 26"]))
        await move.moveProjects(choosing: rig.new, moving: [rig.first, rig.second], session: rig.session, folders: rig.folders)

        #expect(rig.folders.chosen(.editorProjects) == nil)
        #expect(try packages(in: rig.old) == ["Day 25.yapperproj", "Day 26.yapperproj"])
        #expect(rig.session.projectNavigation.currentPackage == rig.first)
        #expect(move.leftBehind?.packages == [rig.first, rig.second])
    }

    @Test("A destination that can't be used stops the move before anything closes")
    func unusableDestinationClosesNothing() async throws {
        let rig = try await rig()
        defer { try? FileManager.default.removeItem(at: rig.root) }
        let move = ProjectFolderMove()
        let gone = rig.root.appending(path: "Gone", directoryHint: .isDirectory)
        await move.moveProjects(choosing: gone, moving: [rig.first, rig.second], session: rig.session, folders: rig.folders)

        #expect(move.outcome != nil)
        #expect(rig.session.projectNavigation.currentPackage == rig.first)
        #expect(rig.folders.chosen(.editorProjects) == nil)
        #expect(!FileManager.default.fileExists(atPath: gone.path))
        #expect(!rig.session.projectNavigation.isMovingProjects)
    }

    @Test("A save that fails before the move stops it and keeps the project open")
    func failedSaveStopsTheMove() async throws {
        let rig = try await rig()
        defer {
            try? FileManager.default.setAttributes([.posixPermissions: 0o755], ofItemAtPath: rig.first.url.path)
            try? FileManager.default.removeItem(at: rig.root)
        }
        try FileManager.default.setAttributes([.posixPermissions: 0o555], ofItemAtPath: rig.first.url.path)
        let move = ProjectFolderMove()
        await move.moveProjects(choosing: rig.new, moving: [rig.first, rig.second], session: rig.session, folders: rig.folders)

        #expect(move.outcome?.contains("couldn’t be saved") == true)
        #expect(rig.session.projectNavigation.currentPackage == rig.first)
        #expect(try packages(in: rig.old) == ["Day 25.yapperproj", "Day 26.yapperproj"])
        #expect(rig.folders.chosen(.editorProjects) == nil)
    }

    @Test("While projects move nothing can open or make one")
    func movingLocksProjects() async throws {
        let rig = try await rig()
        defer { try? FileManager.default.removeItem(at: rig.root) }
        rig.session.projectNavigation.isMovingProjects = true
        await rig.session.openProject(rig.second)
        #expect(rig.session.projectNavigation.currentPackage == rig.first)
        #expect(await rig.session.createProject(named: "Day 27") == false)
        #expect(rig.session.statusMessage == "Wait for your projects to finish moving.")
        #expect(await ProjectFolderMove().blocker(for: rig.session, moving: [rig.first]) != nil)
        rig.session.projectNavigation.isMovingProjects = false
    }

    @Test("Picking the folder already in use, by any path, is recognised as the same folder")
    func sameFolderIsRecognised() async throws {
        let rig = try await rig()
        defer { try? FileManager.default.removeItem(at: rig.root) }
        let link = rig.root.appending(path: "Link", directoryHint: .isDirectory)
        try FileManager.default.createSymbolicLink(at: link, withDestinationURL: rig.old)
        #expect(rig.folders.isCurrentFolder(link, for: .editorProjects))
        #expect(rig.folders.isCurrentFolder(URL(filePath: rig.old.path + "/"), for: .editorProjects))
        #expect(!rig.folders.isCurrentFolder(rig.new, for: .editorProjects))
    }
}
