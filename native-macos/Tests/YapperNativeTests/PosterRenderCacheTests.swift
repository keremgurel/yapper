import AppKit
import Testing
@testable import YapperNative

/// Serialized: the launch tests share the real render folder under the test store.
@Suite(.serialized) struct PosterRenderCacheTests {
    private func scratch() throws -> URL {
        let url = FileManager.default.temporaryDirectory.appending(path: "PosterRenderCacheTests-\(UUID().uuidString)", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        return url
    }

    private func touch(_ url: URL) throws {
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        try Data("x".utf8).write(to: url)
    }

    private func names(in folder: URL) throws -> Set<String> {
        Set(try FileManager.default.contentsOfDirectory(atPath: folder.path))
    }

    @Test func keepsOnlyTheCurrentRevisionAndWhatIsStillBeingWritten() throws {
        let folder = try scratch()
        defer { try? FileManager.default.removeItem(at: folder) }
        let current = String(repeating: "a", count: 64)
        let writing = String(repeating: "b", count: 64)
        let stale = String(repeating: "c", count: 64)
        let crashed = String(repeating: "d", count: 64)
        for name in [
            "\(current).mp4",
            ".\(writing).yapper-export-\(UUID().uuidString).mp4",
            "\(stale).mp4",
            ".\(crashed).yapper-export-\(UUID().uuidString).mp4",
            ".DS_Store",
        ] {
            try touch(folder.appending(path: name))
        }

        PosterRenderCache.removeRenders(in: folder, except: [current, writing])

        let left = try names(in: folder)
        #expect(left.contains("\(current).mp4"))
        #expect(left.contains { $0.hasPrefix(".\(writing).yapper-export-") })
        #expect(!left.contains("\(stale).mp4"))
        #expect(!left.contains { $0.hasPrefix(".\(crashed).") })
        #expect(left.contains(".DS_Store"))
    }

    @Test func removesFoldersOfProjectsThatAreGone() throws {
        let root = try scratch()
        defer { try? FileManager.default.removeItem(at: root) }
        let kept = UUID()
        let gone = UUID()
        try touch(root.appending(path: "\(kept.uuidString)/render.mp4"))
        try touch(root.appending(path: "\(gone.uuidString)/render.mp4"))
        try touch(root.appending(path: "Not a project/render.mp4"))

        PosterRenderCache.removeFolders(in: root, except: [kept])

        #expect(try names(in: root) == [kept.uuidString, "Not a project"])
    }

    @Test func aFinishedRenderRemovesEarlierRevisions() async throws {
        let projects = try scratch()
        defer { try? FileManager.default.removeItem(at: projects) }
        let source = projects.appending(path: "take.mov")
        try await SyntheticVideo.write(color: NSColor.black.cgColor, size: CGSize(width: 160, height: 90), to: source)
        let library = ProjectLibrary(directory: projects)
        let package = try await library.create(named: "Edit")
        var project = EditorProject(name: "Edit")
        let media = ProjectMedia(url: source, name: "Take", duration: 1, width: 160, height: 90, hasAudio: false)
        project.media = [media]
        project.clips = [TimelineClip(mediaID: media.id, sourceStart: 0, sourceEnd: 1)]
        try await ProjectPackageStore(package: package).save(project)
        let listing = try #require(try await library.listings().first)
        let folder = PosterRenderCache.folder(for: project.id)
        defer { try? FileManager.default.removeItem(at: folder) }
        try touch(folder.appending(path: "\(String(repeating: "f", count: 64)).mp4"))

        let rendered = try await PosterProjectRender().render(listing)

        #expect(try names(in: folder) == [rendered.lastPathComponent])
    }

    @Test func launchKeepsOnlyTheCurrentRenderOfEachProject() async throws {
        let projects = try scratch()
        defer { try? FileManager.default.removeItem(at: projects) }
        let library = ProjectLibrary(directory: projects)
        let package = try await library.create(named: "Edit")
        let store = ProjectPackageStore(package: package)
        try await store.save(EditorProject(name: "Edit"))
        let project = try #require(try await store.load())
        let current = try PosterProjectRender.revision(project)
        let folder = PosterRenderCache.folder(for: project.id)
        let gone = PosterRenderCache.folder(for: UUID())
        defer { try? FileManager.default.removeItem(at: folder) }
        try touch(folder.appending(path: "\(current).mp4"))
        try touch(folder.appending(path: "\(String(repeating: "e", count: 64)).mp4"))
        try touch(gone.appending(path: "\(current).mp4"))

        await PosterProjectRender().removeStaleRenders(in: library)

        #expect(try names(in: folder) == ["\(current).mp4"])
        #expect(!FileManager.default.fileExists(atPath: gone.path))
    }

    @Test func launchLeavesRendersAloneWhenTheLibraryIsEmpty() async throws {
        let projects = try scratch()
        defer { try? FileManager.default.removeItem(at: projects) }
        let folder = PosterRenderCache.folder(for: UUID())
        defer { try? FileManager.default.removeItem(at: folder) }
        try touch(folder.appending(path: "render.mp4"))

        await PosterProjectRender().removeStaleRenders(in: ProjectLibrary(directory: projects))

        #expect(FileManager.default.fileExists(atPath: folder.appending(path: "render.mp4").path))
    }
}
