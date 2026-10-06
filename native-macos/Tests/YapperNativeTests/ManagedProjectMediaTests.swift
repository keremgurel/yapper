import Foundation
import CoreGraphics
import Testing
@testable import YapperNative

struct ManagedProjectMediaTests {
    @Test("Managed copies survive removal of originals, preserve edits and relocate with their package", arguments: [false, true])
    func ownedCopy(streaming: Bool) async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: "managed-\(UUID())")
        defer { try? FileManager.default.removeItem(at: root) }
        let library = ProjectLibrary(directory: root.appending(path: "Projects"))
        let package = try await library.create(named: "Edit")
        let original = root.appending(path: "original.mov")
        let bytes = Data(repeating: 42, count: 9 * 1024 * 1024)
        try bytes.write(to: original)
        var project = EditorProject(name: "Edit")
        let media = ProjectMedia(url: original, name: "Original", duration: 12, width: 1080, height: 1920, hasAudio: true)
        project.media = [media]
        project.clips = [TimelineClip(mediaID: media.id, sourceStart: 2, sourceEnd: 9)]
        let store = ProjectPackageStore(package: package)
        try await store.save(project)
        let source = ManagedProjectMedia.Source(id: media.id, url: original)
        try await ManagedProjectMedia.copy(source, into: package, forceStreaming: streaming)
        try FileManager.default.removeItem(at: original)
        // A stale undo snapshot saved after copying must stay managed.
        try await store.save(project)
        let loaded = try #require(try await store.load())
        #expect(loaded.media[0].packagedSource == true)
        #expect(loaded.clips == project.clips)
        #expect(try Data(contentsOf: loaded.media[0].url) == bytes)
        let renamed = try await library.rename(package, to: "Renamed")
        let moved = try #require(try await ProjectPackageStore(package: renamed).load())
        #expect(moved.media[0].url.path.hasPrefix(renamed.url.path))
        #expect(try Data(contentsOf: moved.media[0].url) == bytes)
        let duplicate = try await library.duplicate(renamed)
        let copy = try #require(try await ProjectPackageStore(package: duplicate).load())
        #expect(copy.id != moved.id)
        #expect(try Data(contentsOf: copy.media[0].url) == bytes)
    }

    @Test("The open editor adopts managed footage without losing a newer edit") @MainActor
    func liveEditorAdoptsCopy() async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: "managed-live-\(UUID())")
        defer { try? FileManager.default.removeItem(at: root) }
        let package = try await ProjectLibrary(directory: root).create(named: "Live")
        let source = root.appending(path: "take.mov")
        try await SyntheticVideo.write(color: CGColor(red: 0.2, green: 0.4, blue: 0.8, alpha: 1), size: CGSize(width: 320, height: 180), seconds: 1, to: source)
        let media = try await MediaProbe.inspect(url: source)
        var project = EditorProject(name: "Live")
        project.media = [media]
        project.clips = [TimelineClip(mediaID: media.id, sourceStart: 0, sourceEnd: 0.9)]
        try await ProjectPackageStore(package: package).save(project)
        let session = EditorSession(store: ProjectPackageStore(package: package))
        for _ in 0..<200 where session.project.id != project.id {
            try await Task.sleep(for: .milliseconds(10))
        }
        try #require(session.project.id == project.id)
        session.projectNavigation.currentPackage = package
        try await ManagedProjectMedia.copy(ManagedProjectMedia.Source(id: media.id, url: source, fingerprint: media.sourceFingerprint), into: package)
        session.updateProject { $0.name = "Edited during copy" }
        try await session.adoptManagedMedia(in: package, projectID: project.id)
        try FileManager.default.removeItem(at: source)
        #expect(session.project.name == "Edited during copy")
        let owned = try #require(session.project.media.first)
        #expect(owned.packagedSource == true)
        #expect(session.player.currentItem != nil)
        #expect(session.offlineMedia.isEmpty)
        #expect(FileManager.default.fileExists(atPath: owned.url.path))
    }

    @Test("A retry recovers committed bytes and removes an interrupted partial copy")
    func interruptedCopy() async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: "managed-interrupted-\(UUID())")
        defer { try? FileManager.default.removeItem(at: root) }
        let package = try await ProjectLibrary(directory: root).create(named: "Edit")
        try await ProjectPackageStore(package: package).save(EditorProject())
        let original = root.appending(path: "source.mov")
        try Data(repeating: 7, count: 1_024).write(to: original)
        let source = ManagedProjectMedia.Source(id: UUID(), url: original)
        let target = PackagedMediaLayout.file(for: source.id, extension: "mov", in: package.url)
        try FileManager.default.createDirectory(at: target.deletingLastPathComponent(), withIntermediateDirectories: true)
        try FileManager.default.copyItem(at: original, to: target)
        let partial = target.deletingLastPathComponent().appending(path: ".\(source.id.uuidString).old.importing")
        try Data([1]).write(to: partial)
        try await ManagedProjectMedia.copy(source, into: package)
        #expect(ManagedProjectMedia.resolved(source, in: package) == target)
        #expect(!FileManager.default.fileExists(atPath: partial.path))
    }

    @Test("A cancelled copy never replaces the source or leaves a completed receipt")
    func cancellation() async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: "managed-cancel-\(UUID())")
        defer { try? FileManager.default.removeItem(at: root) }
        let package = try await ProjectLibrary(directory: root).create(named: "Edit")
        try await ProjectPackageStore(package: package).save(EditorProject())
        let source = ManagedProjectMedia.Source(id: UUID(), url: root.appending(path: "missing.mov"))
        let task = Task {
            try Task.checkCancellation()
            try await ManagedProjectMedia.copy(source, into: package, forceStreaming: true)
        }
        task.cancel()
        do { try await task.value; Issue.record("Copy must be cancelled") } catch { }
        #expect(ManagedProjectMedia.resolved(source, in: package) == nil)
        #expect(!FileManager.default.fileExists(atPath: ManagedProjectMedia.receiptURL(source.id, in: package).path))
    }

    @Test("Changed or missing footage is never silently replaced")
    func changedSource() async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: "managed-change-\(UUID())")
        defer { try? FileManager.default.removeItem(at: root) }
        let package = try await ProjectLibrary(directory: root).create(named: "Edit")
        try await ProjectPackageStore(package: package).save(EditorProject())
        let original = root.appending(path: "source.mov")
        try Data([1,2,3]).write(to: original)
        let fingerprint = try await MediaSourceFingerprint.compute(url: original)
        try Data([4,5,6]).write(to: original)
        let source = ManagedProjectMedia.Source(id: UUID(), url: original, fingerprint: fingerprint)
        do { try await ManagedProjectMedia.copy(source, into: package); Issue.record("Must refuse replacement") } catch { }
        #expect(ManagedProjectMedia.resolved(source, in: package) == nil)
    }
}
