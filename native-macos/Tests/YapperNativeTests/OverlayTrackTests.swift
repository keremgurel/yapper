import Foundation
import Testing
@testable import YapperNative

struct OverlayTrackTests {
    private func overlay(
        _ start: Double,
        _ duration: Double,
        track: Int? = nil
    ) -> ProjectOverlay {
        ProjectOverlay(
            mediaID: UUID(),
            timelineStart: start,
            duration: duration,
            track: track
        )
    }

    @Test func anEmptyTimelineStillHasOneLaneToDropInto() {
        #expect(OverlayTracks.count([]) == 1)
        #expect(OverlayTracks.top([]) == -1)
    }

    @Test func lanesAreCountedFromTheHighestInUse() {
        let overlays = [overlay(0, 1, track: 0), overlay(2, 1, track: 2)]
        #expect(OverlayTracks.top(overlays) == 2)
        #expect(OverlayTracks.count(overlays) == 3)
    }

    @Test func aLaneIsBusyOnlyWhereSomethingElseOverlapsInTime() {
        let sitting = overlay(2, 2, track: 1)
        let overlays = [sitting]
        #expect(
            OverlayTracks.isOccupied(1, by: (UUID(), 3, 1), in: overlays)
        )
        // Touching edges do not collide.
        #expect(
            !OverlayTracks.isOccupied(1, by: (UUID(), 4, 1), in: overlays)
        )
        // Another lane is free.
        #expect(
            !OverlayTracks.isOccupied(0, by: (UUID(), 3, 1), in: overlays)
        )
        // An overlay never blocks itself.
        #expect(
            !OverlayTracks.isOccupied(1, by: (sitting.id, 2, 2), in: overlays)
        )
    }

    @Test func aSpanTakesTheLowestFreeLane() {
        let overlays = [overlay(0, 4, track: 0), overlay(1, 2, track: 1)]
        #expect(OverlayTracks.firstFreeTrack(for: (UUID(), 1, 1), in: overlays) == 2)
        #expect(OverlayTracks.firstFreeTrack(for: (UUID(), 8, 1), in: overlays) == 0)
    }

    @Test func deletingALaneClosesTheStackUp() {
        let kept = [overlay(0, 1, track: 0), overlay(2, 1, track: 3)]
        let compacted = OverlayTracks.compacted(kept)
        #expect(compacted.map(\.lane) == [0, 1])
    }

    @Test func higherLanesDrawOverLowerOnes() {
        let low = overlay(0, 2, track: 0)
        let high = overlay(0, 2, track: 1)
        // Given back to front, the last one is the one on top.
        #expect(OverlayTracks.backToFront([high, low]).map(\.id) == [low.id, high.id])
    }

    @Test func twoOverlaysOnOneLaneKeepTheOrderTheyWereAddedIn() {
        let first = overlay(0, 2, track: 0)
        let second = overlay(1, 2, track: 0)
        #expect(OverlayTracks.backToFront([first, second]).map(\.id) == [first.id, second.id])
    }

    @Test func overlappingOverlaysOnOneLaneStillGetSeparateCompositionTracks() {
        let lanes = OverlayCompositionPlan.lanes(
            for: [overlay(0, 4, track: 0), overlay(1, 2, track: 0)]
        )
        #expect(lanes.count == 2)
    }
}

struct TimelineRowLayoutTests {
    private func full(overlayTracks: Int = 1) -> TimelineRowLayout {
        TimelineRowLayout(
            hasText: true,
            overlayTrackCount: overlayTracks,
            hasCaptions: true,
            audioTrackCount: 1
        )
    }

    @Test func aTimelineWithEverythingOnItStacksTheRowsInOrder() {
        let layout = full()
        #expect(layout.textRowY < layout.overlayRowY(track: 0))
        #expect(layout.overlayRowY(track: 0) < layout.captionRowY)
        #expect(layout.captionRowY < layout.clipRowY)
        #expect(layout.clipRowY < layout.audioRowY(track: 0))
        #expect(layout.contentHeight > layout.audioRowY(track: 0))
    }

    @Test func anUntouchedRecordingIsOneRowTall() {
        let bare = TimelineRowLayout()
        #expect(!bare.hasOverlays)
        // The video track sits straight under the ruler.
        #expect(bare.clipRowY == TimelineRowLayout.rulerHeight + TimelineRowLayout.cellInset)
        #expect(bare.contentHeight < full().contentHeight)
    }

    @Test func eachKindOfTrackOnlyTakesRoomOnceItExists() {
        let bare = TimelineRowLayout()
        let withText = TimelineRowLayout(hasText: true)
        let withCaptions = TimelineRowLayout(hasCaptions: true)
        #expect(withText.clipRowY == bare.clipRowY + TimelineRowLayout.textRowHeight)
        #expect(withCaptions.clipRowY == bare.clipRowY + TimelineRowLayout.captionRowHeight)
        // Audio is under the video track, so it moves nothing above it.
        #expect(TimelineRowLayout(audioTrackCount: 1).clipRowY == bare.clipRowY)
        #expect(TimelineRowLayout(audioTrackCount: 1).contentHeight > bare.contentHeight)
        // And a second lane of sound makes the timeline taller again.
        #expect(
            TimelineRowLayout(audioTrackCount: 2).contentHeight
                > TimelineRowLayout(audioTrackCount: 1).contentHeight
        )
    }

    @Test func extraLanesPushEverythingBelowThemDown() {
        let one = full()
        let three = full(overlayTracks: 3)
        let shift = TimelineRowLayout.overlayRowHeight * 2
        #expect(three.clipRowY == one.clipRowY + shift)
        #expect(three.captionRowY == one.captionRowY + shift)
        #expect(three.audioRowY(track: 0) == one.audioRowY(track: 0) + shift)
        // Lane 0 stays next to the speaker's track however tall the stack gets.
        #expect(three.overlayRowY(track: 0) == one.overlayRowY(track: 0) + shift)
        #expect(three.overlayRowY(track: 2) == one.overlayRowY(track: 0))
    }

    @Test func aPointInTheStackNamesItsLane() {
        let layout = full(overlayTracks: 3)
        // The top of the stack is the highest lane.
        #expect(layout.overlayTrack(atY: layout.overlayStackTop + 1) == 2)
        #expect(layout.overlayTrack(atY: layout.overlayRowY(track: 1)) == 1)
        #expect(layout.overlayTrack(atY: layout.overlayRowY(track: 0)) == 0)
    }

    @Test func draggingPastEitherEndOfTheStackStopsAtIt() {
        let layout = full(overlayTracks: 2)
        #expect(layout.overlayTrack(atY: -500) == 1)
        #expect(layout.overlayTrack(atY: 5_000) == 0)
    }
}
