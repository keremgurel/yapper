import Foundation
import Testing
@testable import YapperNative

struct TimelineReorderTests {
    private let durations = [2.0, 4.0, 3.0]

    @Test func aBlockLandsAfterEveryClipWhoseMidpointItPassed() {
        // Clip midpoints sit at 1, 4 and 7.5.
        #expect(TimelineReorderGeometry.insertionIndex(targetStart: 0, remainingDurations: durations) == 0)
        #expect(TimelineReorderGeometry.insertionIndex(targetStart: 0.9, remainingDurations: durations) == 0)
        #expect(TimelineReorderGeometry.insertionIndex(targetStart: 1.1, remainingDurations: durations) == 1)
        #expect(TimelineReorderGeometry.insertionIndex(targetStart: 4.1, remainingDurations: durations) == 2)
        #expect(TimelineReorderGeometry.insertionIndex(targetStart: 99, remainingDurations: durations) == 3)
    }

    @Test func anEmptyTrackTakesTheBlockAtTheFront() {
        #expect(TimelineReorderGeometry.insertionIndex(targetStart: 5, remainingDurations: []) == 0)
    }

    @Test func theBlockCannotBeDraggedOutsideTheProject() {
        // Dragging far left pins to zero, far right leaves exactly the block's
        // own length at the end so it stays fully on the timeline.
        #expect(
            TimelineReorderGeometry.targetStart(
                blockStart: 2, delta: -50, blockDuration: 3, projectDuration: 12
            ) == 0
        )
        #expect(
            TimelineReorderGeometry.targetStart(
                blockStart: 2, delta: 50, blockDuration: 3, projectDuration: 12
            ) == 9
        )
        #expect(
            TimelineReorderGeometry.targetStart(
                blockStart: 2, delta: 1.5, blockDuration: 3, projectDuration: 12
            ) == 3.5
        )
    }

    @Test func draggingRightPastOneNeighbourMovesExactlyOnePlace() {
        // The clip being dragged is excluded from the remaining durations, so
        // moving it just past its neighbour's midpoint swaps the two.
        let remaining = [4.0, 3.0]
        let target = TimelineReorderGeometry.targetStart(
            blockStart: 0, delta: 2.1, blockDuration: 2, projectDuration: 9
        )
        #expect(TimelineReorderGeometry.insertionIndex(targetStart: target, remainingDurations: remaining) == 1)
    }
}
