import Foundation
import Testing

@testable import YapperNative

/// Dragging a cutaway up against the one before it is the most ordinary thing
/// there is. It should come to rest against that one, not slide over it and not
/// be refused.
@Suite struct TimelineLaneNudgeTests {
    private func span(_ start: Double, _ duration: Double) -> TimelineLaneNudge.Span {
        TimelineLaneNudge.Span(start: start, duration: duration)
    }

    @Test func aPushIntoTheNeighbourLandsRightAfterIt() {
        let landing = TimelineLaneNudge.flush(
            span(1.8, 1),
            among: [span(1, 1)],
            reach: 0.5
        )

        #expect(landing?.start == 2)
        #expect(landing?.against == 2)
    }

    /// Coming at it from the other side lands in front of it instead, because
    /// that is the edge it was pushed through.
    @Test func aPushFromTheOtherSideLandsInFrontOfIt() {
        // Pushed 0.8s into the one after it, and out the near side by the
        // same 0.8s.
        let landing = TimelineLaneNudge.flush(
            span(0.8, 1),
            among: [span(1, 1)],
            reach: 1
        )

        #expect(landing?.start == 0)
        #expect(landing?.against == 1)
    }

    /// The pull is measured by how far it was pushed in, not by how far it has
    /// to travel to get out: a long cutaway nudged one frame into its
    /// neighbour still settles against it.
    @Test func aLongItemNudgedOneFrameStillSettles() {
        let landing = TimelineLaneNudge.flush(
            span(0.9, 6),
            among: [span(0, 1)],
            reach: 0.2
        )

        #expect(landing?.start == 1)
    }

    @Test func aFreeSpotIsLeftExactlyWhereItIs() {
        #expect(TimelineLaneNudge.flush(span(4, 1), among: [span(1, 1)], reach: 0.5) == nil)
    }

    /// Touching end to end is not overlapping: that is the position this whole
    /// thing exists to produce.
    @Test func sittingFlushAlreadyIsNotACollision() {
        #expect(TimelineLaneNudge.flush(span(2, 1), among: [span(1, 1)], reach: 0.5) == nil)
    }

    /// Dropped squarely on top of something, far from either edge, is not a
    /// near miss, so it is left to be refused rather than moved somewhere the
    /// creator did not point at.
    @Test func aDropDeepOnTopOfSomethingIsNotNudged() {
        #expect(TimelineLaneNudge.flush(span(4.5, 1), among: [span(4, 4)], reach: 0.5) == nil)
    }

    /// A gap too small to hold it is not a landing spot: it keeps looking, and
    /// takes the nearest side of the pair it is wedged between.
    @Test func aGapTooSmallIsNotUsed() {
        let landing = TimelineLaneNudge.flush(
            span(1.1, 1),
            among: [span(0, 1), span(1.5, 1)],
            reach: 2
        )

        #expect(landing?.start == 2.5)
    }

    /// Pushed a little way into the one after it, it comes back in front of it
    /// rather than jumping the queue.
    @Test func aSmallPushIntoTheNextOneBacksOff() {
        let landing = TimelineLaneNudge.flush(
            span(1.5, 1),
            among: [span(2, 3)],
            reach: 1
        )

        #expect(landing?.start == 1)
        #expect(landing?.against == 2)
    }

    @Test func itNeverLandsBeforeTheStartOfTheTimeline() {
        let landing = TimelineLaneNudge.flush(
            span(0.1, 1),
            among: [span(0, 1)],
            reach: 2
        )

        #expect(landing?.start == 1)
    }
}
