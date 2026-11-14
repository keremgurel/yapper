import AppKit
import Foundation
import Testing
@testable import YapperNative

private actor TrimAddStore: ProjectPersisting {
    func load() async throws -> EditorProject? { nil }
    func save(_ project: EditorProject) async throws {}
}

/// Adding part of a file from the media pane: the new clip or overlay reads
/// only the chosen part, and one undo takes it back.
@Suite(.serialized)
@MainActor
struct MediaTrimAddTests {
    private func session(seconds: Double) async throws -> (EditorSession, ProjectMedia, URL) {
        let directory = FileManager.default.temporaryDirectory
            .appending(path: "yapper-trim-add-\(UUID().uuidString)", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let url = directory.appending(path: "take.mov")
        try await SyntheticVideo.write(
            color: NSColor.blue.cgColor, size: CGSize(width: 160, height: 90), seconds: seconds, to: url
        )
        let session = EditorSession(store: TrimAddStore())
        await session.importMedia([url])
        let media = try #require(session.project.media.first)
        return (session, media, directory)
    }

    @Test("A trimmed part goes on the main track as only that part")
    func trimmedPartIsAppended() async throws {
        let (session, media, directory) = try await session(seconds: 4)
        defer { try? FileManager.default.removeItem(at: directory) }
        let before = session.project.clips.count
        let range = MediaTrimRange(duration: media.duration).movingStart(to: 1).movingEnd(to: 2.5)

        await session.appendMediaToTimeline(media.id, range: range)

        #expect(session.project.clips.count == before + 1)
        let added = try #require(session.project.clips.last)
        #expect(added.mediaID == media.id)
        #expect(abs(added.sourceStart - 1) < 0.001)
        #expect(abs(added.sourceEnd - 2.5) < 0.001)
    }

    @Test("Without a range the whole file goes on, as before")
    func wholeFileIsAppended() async throws {
        let (session, media, directory) = try await session(seconds: 3)
        defer { try? FileManager.default.removeItem(at: directory) }

        await session.appendMediaToTimeline(media.id)

        let added = try #require(session.project.clips.last)
        #expect(added.sourceStart == 0)
        #expect(abs(added.sourceEnd - media.duration) < 0.001)
    }

    @Test("A trimmed part goes on as an overlay reading only that part")
    func trimmedPartIsOverlaid() async throws {
        let (session, media, directory) = try await session(seconds: 4)
        defer { try? FileManager.default.removeItem(at: directory) }
        if session.project.clips.isEmpty { await session.appendMediaToTimeline(media.id) }
        let range = MediaTrimRange(duration: media.duration).movingStart(to: 0.5).movingEnd(to: 1.5)

        await session.addOverlay(media.id, range: range)

        let overlay = try #require(session.overlays.last)
        #expect(overlay.mediaID == media.id)
        #expect(abs(overlay.sourceStart - 0.5) < 0.001)
        #expect(abs(overlay.duration - 1) < 0.001)
    }
}
