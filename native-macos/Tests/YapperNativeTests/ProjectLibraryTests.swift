import Foundation
import Testing
@testable import YapperNative

@Suite(.serialized)
struct ProjectLibraryTests {
    private func withLibrary(_ body: (ProjectLibrary, URL) async throws -> Void) async throws {
        let root = FileManager.default.temporaryDirectory
            .appending(path: "ProjectLibraryTests-\(UUID().uuidString)", directoryHint: .isDirectory)
        defer { try? FileManager.default.removeItem(at: root) }
        let library = ProjectLibrary(directory: root.appending(path: "Projects", directoryHint: .isDirectory))
        try await body(library, root)
    }

    @Test("A new project is a package folder named after it, made unique like Finder does")
    func createsUniquePackages() async throws {
        try await withLibrary { library, _ in
            let first = try await library.create(named: "Day 25")
            let second = try await library.create(named: "Day 25")
            #expect(first.displayName == "Day 25")
            #expect(second.displayName == "Day 25 2")
            #expect(first.url.pathExtension == ProjectPackage.pathExtension)
            var isDirectory: ObjCBool = false
            #expect(FileManager.default.fileExists(atPath: first.url.path, isDirectory: &isDirectory))
            #expect(isDirectory.boolValue)
        }
    }

    @Test("Saving through a package store writes the project, a backup and a summary the grid reads")
    func packageStoreWritesSummary() async throws {
        try await withLibrary { library, _ in
            let package = try await library.create(named: "Take")
            var project = EditorProject(name: "Take")
            let media = ProjectMedia(url: URL(filePath: "/tmp/a.mp4"), name: "a", duration: 60, width: 1080, height: 1920, hasAudio: true)
            project.media = [media]
            project.clips = [TimelineClip(mediaID: media.id, sourceStart: 2, sourceEnd: 12)]
            let store = ProjectPackageStore(package: package)
            try await store.save(project)

            let listings = try await library.listings()
            #expect(listings.count == 1)
            #expect(listings[0].summary.name == "Take")
            #expect(listings[0].summary.duration == 10)
            #expect(listings[0].summary.clipCount == 1)
            #expect(listings[0].summary.posterSource?.time == 2)
            #expect(try await store.load() != nil)
        }
    }

    @Test("Listings come newest first and skip folders that are not projects")
    func listingsOrderAndFilter() async throws {
        try await withLibrary { library, _ in
            let older = try await library.create(named: "Older")
            var first = EditorProject(name: "Older")
            first.updatedAt = Date(timeIntervalSince1970: 1_000)
            try await ProjectPackageStore(package: older).save(first)
            let newer = try await library.create(named: "Newer")
            var second = EditorProject(name: "Newer")
            second.updatedAt = Date(timeIntervalSince1970: 2_000)
            try await ProjectPackageStore(package: newer).save(second)
            try FileManager.default.createDirectory(
                at: library.directory.appending(path: "not a project", directoryHint: .isDirectory),
                withIntermediateDirectories: true
            )

            let names = try await library.listings().map(\.summary.name)
            #expect(names == ["Newer", "Older"])
        }
    }

    @Test("Rename moves the folder; duplicate makes an independent project; trash removes it from the list")
    func renameDuplicateTrash() async throws {
        try await withLibrary { library, _ in
            let package = try await library.create(named: "Draft")
            try await ProjectPackageStore(package: package).save(EditorProject(name: "Draft"))

            let renamed = try await library.rename(package, to: "Final")
            #expect(renamed.displayName == "Final")
            #expect(!FileManager.default.fileExists(atPath: package.url.path))

            let copy = try await library.duplicate(renamed)
            #expect(copy.displayName == "Final copy")
            let originalID = try await ProjectPackageStore(package: renamed).load()?.id
            let copyID = try await ProjectPackageStore(package: copy).load()?.id
            #expect(originalID != nil)
            #expect(copyID != nil)
            #expect(originalID != copyID)

            try await library.trash(copy)
            let names = try await library.listings().map(\.summary.name)
            #expect(names == ["Final"])
        }
    }

    @Test("The legacy single project becomes the first package and is never migrated twice")
    func migratesLegacyProjectOnce() async throws {
        try await withLibrary { library, root in
            let legacyDirectory = root.appending(path: "Legacy", directoryHint: .isDirectory)
            let legacyStore = ProjectStore(directory: legacyDirectory)
            let project = EditorProject(name: "My first take")
            try await legacyStore.save(project)

            let migrated = try await library.migrateLegacyProject(from: legacyDirectory)
            #expect(migrated?.displayName == "My first take")
            let restored = try await ProjectPackageStore(package: migrated!).load()
            #expect(restored?.id == project.id)
            #expect(!FileManager.default.fileExists(
                atPath: legacyDirectory.appending(path: "CurrentProject.json").path
            ))
            #expect(FileManager.default.fileExists(
                atPath: legacyDirectory.appending(path: "CurrentProject.migrated.json").path
            ))

            let again = try await library.migrateLegacyProject(from: legacyDirectory)
            #expect(again == nil)
            #expect(try await library.listings().count == 1)
        }
    }

    @Test("A project file name never contains path separators")
    func fileNamesAreSafe() {
        #expect(ProjectPackage.fileName(for: "a/b:c") == "a-b-c.yapperproj")
        #expect(ProjectPackage.fileName(for: "   ") == "Untitled project.yapperproj")
    }
}
