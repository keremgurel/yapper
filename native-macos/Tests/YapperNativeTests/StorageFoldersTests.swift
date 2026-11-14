import Foundation
import Testing
@testable import YapperNative

@Suite(.serialized)
struct StorageFoldersTests {
    private struct Sandbox {
        let root: URL
        let preferences: MemoryStoragePreferences
        let folders: StorageFolders

        func url(_ path: String) -> URL { root.appending(path: path, directoryHint: .isDirectory) }
        func make(_ path: String) throws -> URL {
            let url = url(path)
            try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
            return url
        }
    }

    private func withSandbox(_ body: (Sandbox) async throws -> Void) async throws {
        let root = FileManager.default.temporaryDirectory
            .appending(path: "StorageFoldersTests-\(UUID().uuidString)", directoryHint: .isDirectory)
        let preferences = MemoryStoragePreferences()
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: root) }
        let folders = StorageFolders(
            preferences: preferences,
            movies: root.appending(path: "Movies", directoryHint: .isDirectory),
            downloads: root.appending(path: "Downloads", directoryHint: .isDirectory)
        )
        try await body(Sandbox(root: root, preferences: preferences, folders: folders))
    }

    private func exists(_ url: URL) -> Bool { FileManager.default.fileExists(atPath: url.path) }

    @Test("Each kind keeps its own folder, and going back to the default forgets only that one")
    func kindsAreIndependent() async throws {
        try await withSandbox { box in
            let drive = box.url("Drive/Yapper Projects")
            let takes = box.url("Takes")
            box.folders.choose(drive, for: .editorProjects)
            box.folders.choose(takes, for: .recorderDownloads)

            #expect(box.folders.folder(for: .editorProjects).path == drive.standardizedFileURL.path)
            #expect(box.folders.folder(for: .recorderDownloads).path == takes.standardizedFileURL.path)
            #expect(box.folders.folder(for: .editorRecordings) == box.folders.defaultFolder(for: .editorRecordings))
            #expect(box.folders.chosen(.exports) == nil)

            box.folders.useDefault(for: .editorProjects)
            #expect(box.folders.chosen(.editorProjects) == nil)
            #expect(box.folders.chosen(.recorderDownloads) != nil)
        }
    }

    @Test("The defaults match where Yapper saved before folders could be chosen")
    func defaultsMatchTheOldPlaces() async throws {
        try await withSandbox { box in
            #expect(box.folders.defaultFolder(for: .editorProjects).lastPathComponent == "Yapper Projects")
            #expect(box.folders.defaultFolder(for: .editorRecordings).lastPathComponent == "Yapper Recordings")
            #expect(box.folders.defaultFolder(for: .recorderDownloads) == box.folders.downloads)
        }
    }

    @Test("A projects folder set by hand before this screen existed is still used, then replaced by a choice")
    func legacyProjectsFolder() async throws {
        try await withSandbox { box in
            let old = try box.make("Hand set")
            box.preferences.setPath(old.path, for: StorageFolders.legacyProjectsKey)
            #expect(box.folders.chosen(.editorProjects)?.path == old.path)

            box.folders.choose(try box.make("Chosen"), for: .editorProjects)
            #expect(box.preferences.path(for: StorageFolders.legacyProjectsKey) == nil)
        }
    }

    @Test("A default folder is made on first use; a chosen one that's gone is never recreated")
    func chosenFoldersAreNeverRecreated() async throws {
        try await withSandbox { box in
            let unplugged = box.url("Unplugged/Yapper Projects")
            box.folders.choose(unplugged, for: .editorProjects)
            #expect(throws: StorageUnavailableError.self) { try box.folders.usableFolder(for: .editorProjects) }
            #expect(!exists(unplugged))
            #expect(!exists(unplugged.deletingLastPathComponent()))

            box.folders.useDefault(for: .editorProjects)
            let made = try box.folders.usableFolder(for: .editorProjects)
            #expect(exists(made))
        }
    }

    @Test("A folder on a drive that isn't mounted reads as disconnected, by the drive's name")
    func driveDisconnected() async throws {
        try await withSandbox { box in
            let volumes = try box.make("Volumes")
            let onDrive = volumes.appending(path: "T7/Yapper Projects", directoryHint: .isDirectory)
            #expect(StorageAvailability.check(onDrive, isDefault: false, volumesRoot: volumes) == .driveDisconnected(name: "T7"))

            try FileManager.default.createDirectory(at: volumes.appending(path: "T7"), withIntermediateDirectories: true)
            #expect(StorageAvailability.check(onDrive, isDefault: false, volumesRoot: volumes) == .folderMissing)
            #expect(StorageAvailability.check(onDrive, isDefault: true, volumesRoot: volumes) == .available)

            try FileManager.default.createDirectory(at: onDrive, withIntermediateDirectories: true)
            #expect(StorageAvailability.check(onDrive, isDefault: false, volumesRoot: volumes) == .available)

            #expect(StorageAvailability.driveName(for: URL(filePath: "/Volumes/T7/a/b")) == "T7")
            #expect(StorageAvailability.driveName(for: URL(filePath: "/Users/me/Movies")) == nil)
            #expect(StorageAvailability.driveName(for: URL(filePath: "/Volumes")) == nil)
        }
    }

    @Test("The library throws for a chosen folder that's gone instead of showing an empty grid")
    func libraryThrowsForMissingFolder() async throws {
        try await withSandbox { box in
            let drive = box.url("Drive/Projects")
            box.folders.choose(drive, for: .editorProjects)
            let library = ProjectLibrary(folders: box.folders)
            await #expect(throws: StorageUnavailableError.self) { try await library.listings() }
            await #expect(throws: StorageUnavailableError.self) { try await library.create(named: "Lost") }
            #expect(!exists(drive))

            try FileManager.default.createDirectory(at: drive, withIntermediateDirectories: true)
            let package = try await library.create(named: "On the drive")
            #expect(package.url.deletingLastPathComponent().standardizedFileURL.path == drive.standardizedFileURL.path)
        }
    }

    @Test("Open, save and export panels start in the chosen folder, or say why they can't")
    func filePanelsStartInTheChosenFolder() async throws {
        try await withSandbox { box in
            let projectsDefault = box.folders.defaultFolder(for: .editorProjects)
            #expect(FilePanelFolder.start(for: .editorProjects, folders: box.folders) == .folder(projectsDefault))
            #expect(FilePanelFolder.start(for: .exports, folders: box.folders) == .lastUsed)

            let drive = try box.make("Drive/Projects")
            box.folders.choose(drive, for: .editorProjects)
            let chosen = box.folders.folder(for: .editorProjects)
            #expect(FilePanelFolder.start(for: .editorProjects, folders: box.folders) == .folder(chosen))

            try FileManager.default.removeItem(at: drive)
            guard case .unavailable(let problem) = FilePanelFolder.start(for: .editorProjects, folders: box.folders) else {
                Issue.record("A projects folder that's gone should say so")
                return
            }
            #expect(problem.contains("“Projects”"))
            #expect(!exists(drive))
        }
    }

    @Test("A picked folder has to be a folder you can write to, outside any project")
    func pickedFolderChecks() async throws {
        try await withSandbox { box in
            let fine = try box.make("Fine")
            let insideProject = try box.make("Day 25.yapperproj/inside")
            #expect(StorageFolderCheck.problem(with: fine) == nil)
            #expect(StorageFolderCheck.problem(with: box.url("Not there")) != nil)
            #expect(StorageFolderCheck.problem(with: insideProject) != nil)
            let leftBehind = try FileManager.default.contentsOfDirectory(atPath: fine.path)
            #expect(leftBehind.isEmpty)
        }
    }

    @Test("Warnings group kinds by drive and fold in the open project when it's on that drive")
    func warningsGroupByDrive() {
        let drive = "NoSuchDrive-\(UUID().uuidString)"
        let statuses: [StorageKind: StorageAvailability] = [
            .editorProjects: .driveDisconnected(name: drive),
            .editorRecordings: .available,
            .recorderDownloads: .folderMissing,
            .exports: .driveDisconnected(name: drive),
        ]
        let warnings = StorageWarning.list(statuses: statuses, openProject: nil)
        #expect(warnings.count == 2)
        #expect(warnings.first?.kinds == [.editorProjects, .exports])
        #expect(warnings.first?.message.contains("“\(drive)” isn’t connected") == true)
        #expect(warnings.last?.availability == .folderMissing)

        let open = ProjectPackage(url: URL(filePath: "/Volumes/\(drive)/Projects/Day 25.yapperproj"))
        let folded = StorageWarning.list(statuses: statuses, openProject: open)
        #expect(folded.count == 2)
        #expect(folded.first?.openProjectName == "Day 25")

        let elsewhere = ProjectPackage(url: URL(filePath: "/Volumes/Other-\(drive)/Day 26.yapperproj"))
        let separate = StorageWarning.list(statuses: [:], openProject: elsewhere)
        #expect(separate.count == 1)
        #expect(separate.first?.kinds.isEmpty == true)
        #expect(separate.first?.openProjectNote != nil)
    }
}

@Suite(.serialized)
struct ProjectMoverTests {
    @Test("A package is the same package with or without the trailing slash a listing adds")
    func packageIdentityIgnoresTrailingSlash() {
        let listed = ProjectPackage(url: URL(filePath: "/Volumes/T7/Projects/Day 25.yapperproj", directoryHint: .isDirectory))
        let saved = ProjectPackage(url: URL(filePath: "/Volumes/T7/Projects/Day 25.yapperproj"))
        #expect(listed.url.absoluteString != saved.url.absoluteString)
        #expect(listed == saved)
        #expect(Set([listed, saved]).count == 1)
        #expect(listed != ProjectPackage(url: URL(filePath: "/Volumes/T7/Projects/Day 26.yapperproj")))
    }

    private func withFolders(_ body: (URL) throws -> Void) throws {
        let root = FileManager.default.temporaryDirectory
            .appending(path: "ProjectMoverTests-\(UUID().uuidString)", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: root) }
        try body(root)
    }

    private func makePackage(named name: String, in folder: URL) throws -> ProjectPackage {
        let package = ProjectPackage(url: folder.appending(path: "\(name).yapperproj", directoryHint: .isDirectory))
        let recordings = package.url.appending(path: "recordings", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: recordings, withIntermediateDirectories: true)
        try Data("{\"name\":\"\(name)\"}".utf8).write(to: package.projectFileURL)
        try Data(repeating: 7, count: 4_096).write(to: recordings.appending(path: "take.mov"))
        return package
    }

    private func make(_ folder: URL) throws -> URL {
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        return folder
    }

    @Test("On one disk a move is a rename and nothing goes to the Trash")
    func sameDiskRenames() throws {
        try withFolders { root in
            let package = try makePackage(named: "Day 25", in: try make(root.appending(path: "Old")))
            let before = ProjectMover.contents(of: package.url)
            let moved = try #require(try ProjectMover.move(package, into: try make(root.appending(path: "New"))))
            #expect(!moved.originalInTrash)
            #expect(!FileManager.default.fileExists(atPath: package.url.path))
            #expect(ProjectMover.contents(of: moved.to) == before)
        }
    }

    @Test("A package already in the folder stays put, even when the folder is reached through a link")
    func alreadyThereIsLeftAlone() throws {
        try withFolders { root in
            let old = try make(root.appending(path: "Old"))
            let package = try makePackage(named: "Day 25", in: old)
            let link = root.appending(path: "Link", directoryHint: .isDirectory)
            try FileManager.default.createSymbolicLink(at: link, withDestinationURL: old)
            #expect(try ProjectMover.move(package, into: old) == nil)
            #expect(try ProjectMover.move(package, into: link, alwaysCopy: true) == nil)
            let left = try FileManager.default.contentsOfDirectory(atPath: old.path)
            #expect(left == ["Day 25.yapperproj"])
        }
    }

    @Test("Across disks the copy is checked and put in place before the original goes to the Trash")
    func acrossDisksCopiesThenTrashes() throws {
        try withFolders { root in
            let package = try makePackage(named: "Day 25", in: try make(root.appending(path: "Mac")))
            let before = ProjectMover.contents(of: package.url)
            let drive = try make(root.appending(path: "Drive"))
            _ = try makePackage(named: "Day 25", in: drive)
            var trashed: [URL] = []
            let moved = try #require(try ProjectMover.move(package, into: drive, alwaysCopy: true, trash: { url in
                #expect(ProjectMover.contents(of: drive.appending(path: "Day 25 2.yapperproj")) == before)
                trashed.append(url)
                try FileManager.default.removeItem(at: url)
            }))
            #expect(moved.originalInTrash)
            #expect(trashed == [package.url])
            #expect(moved.to.lastPathComponent == "Day 25 2.yapperproj")
            #expect(ProjectMover.contents(of: moved.to) == before)
            let left = try FileManager.default.contentsOfDirectory(atPath: drive.path).sorted()
            #expect(left == ["Day 25 2.yapperproj", "Day 25.yapperproj"])
        }
    }

    @Test("A copy with the right sizes but wrong bytes is thrown away and the original isn't touched")
    func spoiledCopyIsCaught() throws {
        try withFolders { root in
            let package = try makePackage(named: "Day 25", in: try make(root.appending(path: "Mac")))
            let drive = try make(root.appending(path: "Drive"))
            var trashed = false
            #expect(throws: ProjectMover.MoveError.copyDidNotMatch("Day 25")) {
                _ = try ProjectMover.move(package, into: drive, alwaysCopy: true, copy: { from, to in
                    try FileManager.default.copyItem(at: from, to: to)
                    let take = to.appending(path: "recordings/take.mov")
                    try Data(repeating: 8, count: 4_096).write(to: take)
                }, trash: { _ in trashed = true })
            }
            #expect(!trashed)
            #expect(FileManager.default.fileExists(atPath: package.url.appending(path: "recordings/take.mov").path))
            #expect(try FileManager.default.contentsOfDirectory(atPath: drive.path).isEmpty)
        }
    }

    @Test("The ._ files a drive adds to hold attributes don't count as a mismatch, but any other extra file does")
    func appleDoubleFilesAreIgnored() throws {
        try withFolders { root in
            let original = try makePackage(named: "Day 25", in: try make(root.appending(path: "Mac")))
            let copy = root.appending(path: "Copy.yapperproj", directoryHint: .isDirectory)
            try FileManager.default.copyItem(at: original.url, to: copy)
            try Data(repeating: 1, count: 4_096).write(to: copy.appending(path: "recordings/._take.mov"))
            #expect(ProjectMover.copyMatches(original.url, copy))
            try Data("stray".utf8).write(to: copy.appending(path: "recordings/stray.txt"))
            #expect(!ProjectMover.copyMatches(original.url, copy))
        }
    }

    @Test("When the original can't go to the Trash both copies stay and the move says so")
    func trashFailureKeepsBoth() throws {
        try withFolders { root in
            let package = try makePackage(named: "Day 25", in: try make(root.appending(path: "Mac")))
            let drive = try make(root.appending(path: "Drive"))
            let moved = try #require(try ProjectMover.move(package, into: drive, alwaysCopy: true, trash: { _ in
                throw CocoaError(.fileWriteNoPermission)
            }))
            #expect(moved.originalKept)
            #expect(FileManager.default.fileExists(atPath: package.url.path))
            #expect(FileManager.default.fileExists(atPath: moved.to.path))
        }
    }

    @Test("Copies left by an interrupted move are swept, and nothing else is")
    func stagingCopiesAreSwept() throws {
        try withFolders { root in
            let folder = try make(root.appending(path: "Drive"))
            let kept = try makePackage(named: "Day 25", in: folder)
            let staging = ProjectMoveStaging.url(in: folder)
            try FileManager.default.createDirectory(at: staging, withIntermediateDirectories: true)
            #expect(ProjectMoveStaging.sweep(in: folder) == 1)
            #expect(!FileManager.default.fileExists(atPath: staging.path))
            #expect(FileManager.default.fileExists(atPath: kept.url.path))

            let folders = StorageFolders(
                preferences: MemoryStoragePreferences(),
                movies: root.appending(path: "Movies", directoryHint: .isDirectory),
                downloads: root.appending(path: "Downloads", directoryHint: .isDirectory)
            )
            let abandoned = ProjectMoveStaging.url(in: folder)
            try FileManager.default.createDirectory(at: abandoned, withIntermediateDirectories: true)
            ProjectMoveStaging.noteMoving(into: folder, preferences: folders.preferences)
            ProjectMoveStaging.sweepAfterLaunch(folders: folders)
            #expect(!FileManager.default.fileExists(atPath: abandoned.path))
            #expect(folders.preferences.path(for: ProjectMoveStaging.destinationKey) == nil)
        }
    }

    @Test("A copy stranded on a pulled drive stays noted until a launch finds the drive back")
    func strandedCopyWaitsForTheDrive() throws {
        try withFolders { root in
            let folders = StorageFolders(
                preferences: MemoryStoragePreferences(),
                movies: root.appending(path: "Movies", directoryHint: .isDirectory),
                downloads: root.appending(path: "Downloads", directoryHint: .isDirectory)
            )
            let drive = root.appending(path: "Drive", directoryHint: .isDirectory)
            ProjectMoveStaging.noteMoving(into: drive, preferences: folders.preferences)
            // The move ends, then the app launches, both with the drive away.
            ProjectMoveStaging.finishMoving(into: drive, preferences: folders.preferences)
            ProjectMoveStaging.sweepAfterLaunch(folders: folders)
            #expect(folders.preferences.path(for: ProjectMoveStaging.destinationKey) != nil)
            #expect(!FileManager.default.fileExists(atPath: drive.path))

            let stranded = ProjectMoveStaging.url(in: try make(drive))
            try FileManager.default.createDirectory(at: stranded, withIntermediateDirectories: true)
            ProjectMoveStaging.sweepAfterLaunch(folders: folders)
            #expect(!FileManager.default.fileExists(atPath: stranded.path))
            #expect(folders.preferences.path(for: ProjectMoveStaging.destinationKey) == nil)
        }
    }

    @Test("Saving a project never makes the folders above its package")
    func saveNeverMakesParentFolders() async throws {
        let root = FileManager.default.temporaryDirectory
            .appending(path: "ProjectMoverTests-\(UUID().uuidString)", directoryHint: .isDirectory)
        defer { try? FileManager.default.removeItem(at: root) }
        let renamed = root.appending(path: "Renamed away", directoryHint: .isDirectory)
        let stranded = ProjectPackageStore(package: ProjectPackage(url: renamed.appending(path: "Day 25.yapperproj", directoryHint: .isDirectory)))
        await #expect(throws: (any Error).self) { try await stranded.save(EditorProject(name: "Day 25")) }
        #expect(!FileManager.default.fileExists(atPath: renamed.path))

        try FileManager.default.createDirectory(at: renamed, withIntermediateDirectories: true)
        try await stranded.save(EditorProject(name: "Day 25"))
        #expect(FileManager.default.fileExists(atPath: renamed.appending(path: "Day 25.yapperproj").path))
    }

    @Test("The summary says where projects went and that the originals are in the Trash")
    func summaryNamesTheTrash() {
        let drive = URL(filePath: "/Volumes/T7/Yapper Projects")
        let moved = ProjectMover.Moved(from: URL(filePath: "/a.yapperproj"), to: drive.appending(path: "a.yapperproj"), originalInTrash: true, originalKept: false)
        let text = ProjectMoveSummary.sentence(moved: [moved, moved], failures: ["“b”: no space."], folder: drive)
        #expect(text.contains("Moved 2 projects to “Yapper Projects”."))
        #expect(text.contains("The originals are in the Trash."))
        #expect(!text.contains("Empty"))
        #expect(text.contains("“b”: no space."))
    }
}
