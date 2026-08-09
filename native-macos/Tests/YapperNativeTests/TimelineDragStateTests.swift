import Foundation
import Testing

@testable import YapperNative

/// The drag state is what the tracks draw their feedback from, so anything left
/// behind in it shows up as a gap the creator cannot close. These pin down that
/// it can always be got out of.
@MainActor
@Suite struct TimelineDragStateTests {
    private func dragging() -> TimelineDragState {
        let state = TimelineDragState()
        state.begin(UUID())
        state.setOffset(1.5, plan: TimelineReorderPlan(insertionIndex: 2, blockDuration: 3))
        return state
    }

    @Test func aDragIsOnlyLiveWhileAGestureClaimsIt() {
        let state = TimelineDragState()
        #expect(!state.isDragging)

        state.begin(UUID())
        #expect(state.isDragging)

        state.end()
        #expect(!state.isDragging)
    }

    /// The regression: a plan outliving its gesture drew a gap with nothing able
    /// to close it. The tracks now draw off the claim, so a leftover plan is
    /// invisible even before anything cleans it up.
    @Test func aPlanWithoutAGestureIsNotALiveDrag() {
        let state = dragging()
        state.end()

        #expect(state.reorderPlan != nil)
        #expect(!state.isDragging)
        // And the watchdog can still see there is something to tidy away.
        #expect(state.isStranded)
    }

    /// Clearing wipes the feedback but keeps the drag.
    ///
    /// The regression this pins: a drag clears its reorder preview the instant
    /// the item is carried off its own row, and it is still very much live at
    /// that point. Releasing the claim there meant the drop line was never
    /// drawn — the one piece of feedback saying which track it was going to.
    @Test func clearingKeepsTheDragAlive() {
        let state = dragging()

        state.clear()

        #expect(state.offset == 0)
        #expect(state.reorderPlan == nil)
        #expect(state.lift == nil)
        #expect(state.isDragging, "the gesture has not let go yet")
    }

    @Test func endingReleasesEverything() {
        let state = dragging()
        state.setLift(
            TimelineLift(
                itemID: UUID(),
                title: "clip",
                duration: 2,
                target: TimelineDropTarget(track: .overlay(lane: 0, isNew: true), start: 1)
            )
        )

        state.clear()
        state.end()

        #expect(state.lift == nil)
        #expect(!state.isDragging)
        #expect(!state.isStranded)
    }

    @Test func anyGestureCanClaimTheDragWithoutNamingItself() {
        let state = TimelineDragState()
        state.claimIfNeeded()
        #expect(state.isDragging)
    }

    /// A named claim wins, so the item a drag belongs to is not overwritten by a
    /// later anonymous one.
    @Test func anAnonymousClaimNeverStealsANamedOne() {
        let state = TimelineDragState()
        let id = UUID()
        state.begin(id)

        state.claimIfNeeded()

        #expect(state.activeItemID == id)
    }

    @Test func escapeCancelsAndTheNextDragStartsClean() {
        let state = dragging()

        state.cancel()
        #expect(state.isCancelled)
        #expect(state.reorderPlan == nil)
        #expect(!state.isDragging)

        state.begin(UUID())
        #expect(!state.isCancelled)
    }
}
