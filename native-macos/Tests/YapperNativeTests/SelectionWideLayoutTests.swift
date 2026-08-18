import AppKit
import CoreGraphics
import Foundation
import Testing

@testable import YapperNative

/// Marquee a run of clips or cutaways, place one of them, and the run goes with
/// it. A creator who has picked out twenty items has already said which ones
/// they mean; making them repeat the same move twenty times is the bug.
@MainActor
@Suite struct SelectionWideLayoutTests {
    func sessionForOutsideTest(url: URL) async -> EditorSession { await session(url: url) }
    func movieForOutsideTest() async throws -> URL { try await movie() }

    private func session(url: URL) async -> EditorSession {
        let session = EditorSession(store: QuietSelectionStore())
        for _ in 0 ..< 500 where session.isBusy { await Task.yield() }
        let mediaID = UUID()
        session.updateProject { project in
            project.media = [ProjectMedia(
                id: mediaID,
                url: url,
                name: url.lastPathComponent,
                duration: 4,
                width: 160,
                height: 90,
                hasAudio: false
            )]
            project.clips = [
                TimelineClip(mediaID: mediaID, sourceStart: 0, sourceEnd: 1),
                TimelineClip(mediaID: mediaID, sourceStart: 1, sourceEnd: 2),
                TimelineClip(mediaID: mediaID, sourceStart: 2, sourceEnd: 3),
            ]
            project.overlays = [
                ProjectOverlay(mediaID: mediaID, timelineStart: 0, duration: 1),
                ProjectOverlay(mediaID: mediaID, timelineStart: 1, duration: 1),
                ProjectOverlay(mediaID: mediaID, timelineStart: 2, duration: 1),
            ]
        }
        return session
    }

    private func movie() async throws -> URL {
        let url = URL(filePath: NSTemporaryDirectory())
            .appending(path: "selection-layout-\(UUID().uuidString).mov")
        try await SyntheticVideo.write(
            color: NSColor.black.cgColor,
            size: CGSize(width: 160, height: 90),
            seconds: 4,
            to: url
        )
        return url
    }

    @Test func framingLandsOnEverySelectedClip() async throws {
        let url = try await movie()
        defer { try? FileManager.default.removeItem(at: url) }
        let session = await session(url: url)
        let clips = session.project.clips
        session.setTimelineSelection([.clip(clips[0].id), .clip(clips[2].id)])

        session.commitFraming(VideoFraming(scale: 1.4, x: 0.1, y: -0.2), clipID: clips[0].id)

        #expect(session.project.clips[0].framing?.scale == 1.4)
        #expect(session.project.clips[2].framing?.scale == 1.4)
        // The one that was not selected is left where it was.
        #expect(session.project.clips[1].framing == nil)
    }

    /// Typing the position the current clip already has is how a creator says
    /// "and these too", so it must not be read as a no-op.
    @Test func framingSpreadsEvenWhenTheEditedClipIsAlreadyThere() async throws {
        let url = try await movie()
        defer { try? FileManager.default.removeItem(at: url) }
        let session = await session(url: url)
        let clips = session.project.clips
        let framing = VideoFraming(scale: 1.2, x: 0, y: 0.05)
        session.setTimelineSelection([.clip(clips[0].id)])
        session.commitFraming(framing, clipID: clips[0].id)
        session.setTimelineSelection([.clip(clips[0].id), .clip(clips[1].id)])

        session.commitFraming(framing, clipID: clips[0].id)

        #expect(session.project.clips[1].framing?.scale == 1.2)
    }

    @Test func framingOneClipOnItsOwnLeavesTheRest() async throws {
        let url = try await movie()
        defer { try? FileManager.default.removeItem(at: url) }
        let session = await session(url: url)
        let clips = session.project.clips
        session.setTimelineSelection([.clip(clips[1].id)])

        session.commitFraming(VideoFraming(scale: 1.3, x: 0, y: 0), clipID: clips[1].id)

        #expect(session.project.clips[1].framing?.scale == 1.3)
        #expect(session.project.clips[0].framing == nil)
        #expect(session.project.clips[2].framing == nil)
    }

    @Test func movingOneSelectedCutawayMovesThemAll() async throws {
        let url = try await movie()
        defer { try? FileManager.default.removeItem(at: url) }
        let session = await session(url: url)
        let overlays = session.overlays
        session.setTimelineSelection([.overlay(overlays[0].id), .overlay(overlays[1].id)])

        var moved = overlays[0]
        moved.x = 0.11
        moved.y = 0.62
        moved.width = 0.5
        moved.height = 0.5
        session.commitOverlayEdit(moved)

        let after = session.overlays
        #expect(after[0].x == 0.11)
        #expect(after[1].x == 0.11)
        #expect(after[1].y == 0.62)
        #expect(after[1].width == 0.5)
        // Not selected, so not touched.
        #expect(after[2].x == overlays[2].x)
    }

    /// Trimming or re-laning one of a selected run is about that one cutaway,
    /// so nothing else follows it.
    @Test func trimmingOneCutawayLeavesTheOthersAlone() async throws {
        let url = try await movie()
        defer { try? FileManager.default.removeItem(at: url) }
        let session = await session(url: url)
        let overlays = session.overlays
        session.setTimelineSelection([.overlay(overlays[0].id), .overlay(overlays[1].id)])

        var trimmed = overlays[0]
        trimmed.duration = 0.5
        session.commitOverlayEdit(trimmed)

        let after = session.overlays
        #expect(after[0].duration == 0.5)
        #expect(after[1].duration == 1)
    }
}

private actor QuietSelectionStore: ProjectPersisting {
    func load() async throws -> EditorProject? { nil }
    func save(_: EditorProject) async throws {}
}

extension SelectionWideLayoutTests {
    /// Dragging a cutaway that is not part of the selection is how that one
    /// gets picked up, so nothing else follows it.
    @Test func movingACutawayOutsideTheSelectionMovesOnlyIt() async throws {
        let url = try await movieForOutsideTest()
        defer { try? FileManager.default.removeItem(at: url) }
        let session = await sessionForOutsideTest(url: url)
        let overlays = session.overlays
        session.setTimelineSelection([.overlay(overlays[0].id), .overlay(overlays[1].id)])

        var moved = overlays[2]
        moved.x = 0.05
        session.commitOverlayEdit(moved)

        let after = session.overlays
        #expect(after[2].x == 0.05)
        #expect(after[0].x == overlays[0].x)
        #expect(after[1].x == overlays[1].x)
    }
}
