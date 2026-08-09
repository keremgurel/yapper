import Foundation
import Testing
@testable import YapperNative

struct OverlayCompositionPlanTests {
    private func overlay(_ start: Double, _ duration: Double) -> ProjectOverlay {
        ProjectOverlay(mediaID: UUID(), timelineStart: start, duration: duration)
    }

    @Test func overlaysThatNeverShareTheScreenShareOneTrack() {
        let lanes = OverlayCompositionPlan.lanes(
            for: [overlay(0, 2), overlay(2, 2), overlay(5, 1)]
        )
        #expect(lanes.count == 1)
        #expect(lanes[0].count == 3)
    }

    @Test func overlappingOverlaysGetTheirOwnTrackWithTheNewerOneOnTop() {
        let first = overlay(0, 4)
        let second = overlay(1, 2)
        let lanes = OverlayCompositionPlan.lanes(for: [first, second])
        #expect(lanes.count == 2)
        #expect(lanes[0].map(\.id) == [first.id])
        // Later lane, drawn over the earlier one.
        #expect(lanes[1].map(\.id) == [second.id])
    }

    @Test func aZeroLengthOverlayIsNotGivenATrack() {
        #expect(OverlayCompositionPlan.lanes(for: [overlay(1, 0)]).isEmpty)
    }

    @Test func instructionsBreakOnEveryCutAndEveryOverlayEdge() {
        let boundaries = OverlayCompositionPlan.boundaries(
            clipEnds: [3, 6],
            overlays: [overlay(1, 1.5)],
            duration: 6
        )
        #expect(boundaries == [0, 1, 2.5, 3, 6])
    }

    @Test func aBoundaryThatLandsOnACutIsNotCountedTwice() {
        let boundaries = OverlayCompositionPlan.boundaries(
            clipEnds: [2, 4],
            overlays: [overlay(2, 2)],
            duration: 4
        )
        #expect(boundaries == [0, 2, 4])
    }

    @Test func anOverlayRunningPastTheEndIsClampedToIt() {
        let boundaries = OverlayCompositionPlan.boundaries(
            clipEnds: [3],
            overlays: [overlay(2, 90)],
            duration: 3
        )
        #expect(boundaries == [0, 2, 3])
    }

    @Test func anEmptyTimelineDescribesNoIntervals() {
        #expect(OverlayCompositionPlan.boundaries(clipEnds: [], overlays: [], duration: 0).isEmpty)
    }

    @Test func aLaneReportsWhichOverlayCoversAnInterval() {
        let first = overlay(0, 2)
        let second = overlay(4, 2)
        let lane = [first, second]
        #expect(OverlayCompositionPlan.overlay(in: lane, from: 0, to: 2)?.id == first.id)
        #expect(OverlayCompositionPlan.overlay(in: lane, from: 2, to: 4) == nil)
        #expect(OverlayCompositionPlan.overlay(in: lane, from: 4, to: 6)?.id == second.id)
    }
}
