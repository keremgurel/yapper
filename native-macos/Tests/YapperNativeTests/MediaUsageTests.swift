import Foundation
import Testing

@testable import YapperNative

/// Which files the timeline already uses, and which parts of them.
struct MediaUsageTests {
    private let take = UUID()
    private let cutaway = UUID()

    private func overlay(_ mediaID: UUID, sourceStart: Double, duration: Double, rate: Double? = nil) -> ProjectOverlay {
        var overlay = ProjectOverlay(mediaID: mediaID, timelineStart: 0, duration: duration, sourceStart: sourceStart)
        overlay.playbackRate = rate
        return overlay
    }

    @Test func aFileNobodyUsesIsNotPlaced() {
        let usage = MediaUsage.byMedia(clips: [], overlays: [])
        #expect(usage[take] == nil)
        #expect(!MediaUsage.none.isPlaced)
        #expect(MediaUsage.none.summary == nil)
    }

    @Test func mainTrackClipsAreCountedWithTheirParts() {
        let usage = MediaUsage.byMedia(clips: [
            TimelineClip(mediaID: take, sourceStart: 0, sourceEnd: 4),
            TimelineClip(mediaID: take, sourceStart: 10, sourceEnd: 12),
        ], overlays: [])
        #expect(usage[take]?.mainTrackCount == 2)
        #expect(usage[take]?.parts == [.init(start: 0, end: 4), .init(start: 10, end: 12)])
        #expect(usage[take]?.summary == "On the main track ×2")
    }

    @Test func anOverlayCountsThePartItPlays() {
        let usage = MediaUsage.byMedia(clips: [], overlays: [overlay(cutaway, sourceStart: 2, duration: 3, rate: 2)])
        #expect(usage[cutaway]?.overlayCount == 1)
        // Three seconds on the timeline at double speed reads six of the file.
        #expect(usage[cutaway]?.parts == [.init(start: 2, end: 8)])
        #expect(usage[cutaway]?.summary == "Used as an overlay")
    }

    @Test func aFileUsedBothWaysSaysBoth() {
        let usage = MediaUsage.byMedia(
            clips: [TimelineClip(mediaID: take, sourceStart: 0, sourceEnd: 1)],
            overlays: [overlay(take, sourceStart: 0, duration: 1), overlay(take, sourceStart: 4, duration: 1)]
        )
        #expect(usage[take]?.summary == "On the main track and as an overlay ×2")
        #expect(usage[take]?.isPlaced == true)
    }
}
