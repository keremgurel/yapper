import AppKit
import CoreGraphics
import Foundation
import Testing

@testable import YapperNative

/// The player draws the cutaways in the same picture as the speaker, so a
/// framing gesture shown as a transform over the whole player carried them with
/// it. What the composition is showing has to follow the gesture instead.
@MainActor
@Suite struct FramingPreviewTests {
    private func movie() async throws -> URL {
        let url = URL(filePath: NSTemporaryDirectory())
            .appending(path: "framing-preview-\(UUID().uuidString).mov")
        try await SyntheticVideo.write(
            color: NSColor.black.cgColor,
            size: CGSize(width: 160, height: 90),
            seconds: 3,
            to: url
        )
        return url
    }

    private func session(url: URL) async -> (EditorSession, UUID) {
        let session = EditorSession(store: QuietFramingStore())
        for _ in 0 ..< 500 where session.isBusy { await Task.yield() }
        let mediaID = UUID()
        session.updateProject { project in
            project.media = [ProjectMedia(
                id: mediaID,
                url: url,
                name: url.lastPathComponent,
                duration: 3,
                width: 160,
                height: 90,
                hasAudio: false
            )]
            project.clips = [TimelineClip(mediaID: mediaID, sourceStart: 0, sourceEnd: 2)]
        }
        _ = await session.commitTimelineEdit { true }
        return (session, session.project.clips[0].id)
    }

    @Test func aGestureMovesWhatTheCompositionShows() async throws {
        let url = try await movie()
        defer { try? FileManager.default.removeItem(at: url) }
        let (session, clipID) = await session(url: url)
        let framing = VideoFraming(scale: 1.3, x: 0.05, y: -0.12)

        session.previewFraming(framing, clipID: clipID)
        for _ in 0 ..< 500 where session.renderedFraming.framing(for: clipID, atSource: 0) != framing {
            try? await Task.sleep(for: .milliseconds(10))
        }

        #expect(session.renderedFraming.framing(for: clipID, atSource: 0) == framing)
        // Nothing is written to the project until the gesture ends, so a drag
        // is still one undo step and one save.
        #expect(session.project.clips[0].framing == nil)
    }

    /// Once the composition agrees with the gesture there is nothing left for
    /// the transform to do, which is the whole point: a transform of nothing
    /// cannot carry a cutaway anywhere.
    @Test func theTransformFallsAwayOnceTheCompositionAgrees() async throws {
        let url = try await movie()
        defer { try? FileManager.default.removeItem(at: url) }
        let (session, clipID) = await session(url: url)
        session.selectedClipID = clipID
        let framing = VideoFraming(scale: 1.2, x: 0.08, y: 0)

        session.commitFraming(framing, clipID: clipID)
        for _ in 0 ..< 500 where session.renderedFraming.framing(for: clipID, atSource: 0) != framing {
            try? await Task.sleep(for: .milliseconds(10))
        }

        let preview = session.framingPreviewTransform
        #expect(preview == nil || (preview!.scale == 1 && preview!.x == 0 && preview!.y == 0))
    }
}

private actor QuietFramingStore: ProjectPersisting {
    func load() async throws -> EditorProject? { nil }
    func save(_: EditorProject) async throws {}
}
