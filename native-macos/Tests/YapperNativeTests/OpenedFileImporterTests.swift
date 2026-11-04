@preconcurrency import AVFoundation
import AppKit
import Foundation
import Testing
@testable import YapperNative

/// Files opened with Yapper from Finder, the Dock or `open -a`.
struct OpenedFileKindTests {
    @Test func videosImagesAndSoundsAreRecognised() {
        #expect(OpenedFileImporter.Kind(url: URL(filePath: "/tmp/does-not-exist/take.mov")) == .media)
        #expect(OpenedFileImporter.Kind(url: URL(filePath: "/tmp/does-not-exist/card.png")) == .media)
        #expect(OpenedFileImporter.Kind(url: URL(filePath: "/tmp/does-not-exist/sting.m4a")) == .audio)
        #expect(OpenedFileImporter.Kind(url: URL(filePath: "/tmp/does-not-exist/notes.txt")) == .unsupported)
        #expect(OpenedFileImporter.Kind(url: URL(string: "https://ypr.app/take.mov")!) == .unsupported)
    }
}

@MainActor
@Suite(.serialized)
struct OpenedFileImporterTests {
    private func video(named name: String, in root: URL) async throws -> URL {
        let url = root.appending(path: "\(name).mov")
        try await SyntheticVideo.write(color: NSColor.black.cgColor, size: CGSize(width: 160, height: 90), seconds: 2, to: url)
        return url
    }

    private func session() async -> EditorSession {
        let session = EditorSession(store: ProjectStore(directory: FileManager.default.temporaryDirectory
            .appending(path: "opened-files-\(UUID().uuidString)", directoryHint: .isDirectory)))
        await Task.yield()
        return session
    }

    @Test func aVideoOpenedWithNoProjectMakesOneNamedAfterIt() async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: "opened-\(UUID())")
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: root) }
        let name = "TEF ad \(UUID().uuidString.prefix(6))"
        let url = try await video(named: name, in: root)
        let session = await session()
        defer { session.player.replaceCurrentItem(with: nil) }
        #expect(session.projectNavigation.currentPackage == nil)

        let importer = OpenedFileImporter()
        importer.receive(url, into: session)
        await importer.settle()

        let package = try #require(session.projectNavigation.currentPackage)
        defer { try? FileManager.default.removeItem(at: package.url) }
        #expect(session.project.name == name)
        #expect(session.project.clips.count == 1)
        #expect(!session.projectNavigation.showsProjectsHome)
    }

    @Test func filesOpenedTogetherLandInTheOpenProjectAsOneImport() async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: "opened-\(UUID())")
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: root) }
        let main = try await video(named: "main", in: root), broll = try await video(named: "broll", in: root)
        let notes = root.appending(path: "notes.txt")
        try Data("hi".utf8).write(to: notes)
        let session = await session()
        defer { session.player.replaceCurrentItem(with: nil) }
        await session.createProject(named: "Open with \(UUID().uuidString.prefix(6))")
        let package = try #require(session.projectNavigation.currentPackage)
        defer { try? FileManager.default.removeItem(at: package.url) }

        // One URL at a time, the way Finder delivers a multi-file Open With.
        let importer = OpenedFileImporter()
        for url in [main, broll, notes] { importer.receive(url, into: session) }
        await importer.settle()

        #expect(session.projectNavigation.currentPackage == package)
        #expect(session.project.media.map(\.name).sorted() == ["broll.mov", "main.mov"])
        // The first video is the edit; the next waits in the bin.
        #expect(session.project.clips.count == 1)
        #expect(session.project.clips.first?.mediaID == session.project.media.first { $0.name == "main.mov" }?.id)
    }
}
