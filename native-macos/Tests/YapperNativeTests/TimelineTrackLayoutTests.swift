import Foundation
import Testing

@testable import YapperNative

/// Where the clips sit during a drag. This is the whole track layout now, so a
/// wrong answer here is a clip drawn in the wrong place or a gap that will not
/// close.
@Suite struct TimelineTrackLayoutTests {
    private let a = UUID()
    private let b = UUID()
    private let c = UUID()

    private var clips: [TimelineTrackLayout.Clip] {
        [
            .init(id: a, duration: 2),
            .init(id: b, duration: 3),
            .init(id: c, duration: 5),
        ]
    }

    @Test func clipsButtUpAgainstEachOtherWhenNothingIsHappening() {
        let positions = TimelineTrackLayout.positions(clips: clips)
        #expect(positions[a] == 0)
        #expect(positions[b] == 2)
        #expect(positions[c] == 5)
    }

    /// The clip under the pointer stays under the pointer. Anything else and the
    /// drag feels like it is fighting you.
    @Test func theDraggedClipTracksThePointer() {
        let positions = TimelineTrackLayout.positions(
            clips: clips,
            drag: .init(movingIDs: [a], offset: 1.4, insertionIndex: 0)
        )
        #expect(positions[a] == 1.4)
    }

    @Test func theOthersOpenAGapWhereItWouldLand() {
        // Dragging the first clip far enough right to land last.
        let positions = TimelineTrackLayout.positions(
            clips: clips,
            drag: .init(movingIDs: [a], offset: 7, insertionIndex: 2)
        )
        // b and c close up to the front, and the gap opens after them.
        #expect(positions[b] == 0)
        #expect(positions[c] == 3)
        #expect(positions[a] == 7)
    }

    @Test func aGapAtTheFrontPushesEverythingAlong() {
        let positions = TimelineTrackLayout.positions(
            clips: clips,
            drag: .init(movingIDs: [c], offset: -5, insertionIndex: 0)
        )
        #expect(positions[a] == 5)
        #expect(positions[b] == 7)
    }

    /// The regression from the screenshot: a clip carried up to an overlay lane
    /// leaves for good, so the track has to close up rather than hold a gap open
    /// for something that is never coming back.
    @Test func aLiftedClipLeavesNoGapBehindIt() {
        let positions = TimelineTrackLayout.positions(
            clips: clips,
            drag: .init(liftedID: b)
        )
        #expect(positions[a] == 0)
        // b keeps the spot it came from; the pointer carries it from there.
        #expect(positions[b] == 2)
        // c slides into the space b is vacating.
        #expect(positions[c] == 2)
    }

    @Test func liftingTheFirstClipPullsTheRestForward() {
        let positions = TimelineTrackLayout.positions(clips: clips, drag: .init(liftedID: a))
        #expect(positions[a] == 0)
        #expect(positions[b] == 0)
        #expect(positions[c] == 3)
    }

    @Test func aBlockOfClipsMovesTogether() {
        let positions = TimelineTrackLayout.positions(
            clips: clips,
            drag: .init(movingIDs: [a, b], offset: 4, insertionIndex: 1)
        )
        #expect(positions[a] == 4)
        #expect(positions[b] == 6)
        // The one staying put moves to the front, and the gap opens after it.
        #expect(positions[c] == 0)
    }

    /// Every clip has to be given a position on every frame, or one of them
    /// silently falls back to zero and stacks on top of the first.
    @Test func everyClipIsAccountedFor() {
        for drag: TimelineTrackLayout.Drag in [
            .idle,
            .init(movingIDs: [a], offset: 3, insertionIndex: 1),
            .init(liftedID: c),
        ] {
            let positions = TimelineTrackLayout.positions(clips: clips, drag: drag)
            #expect(positions.count == 3)
        }
    }
}

/// Something arriving from another track — an overlay dropped back onto the
/// speaker's row — owns no clips there yet, so the room it needs cannot be
/// worked out from the clips that are moving. It brings its own length.
@Suite struct TimelineArrivingClipLayoutTests {
    private let a = UUID()
    private let b = UUID()

    private var clips: [TimelineTrackLayout.Clip] {
        [.init(id: a, duration: 4), .init(id: b, duration: 4)]
    }

    @Test func anArrivingClipPushesTheOthersApart() {
        let positions = TimelineTrackLayout.positions(
            clips: clips,
            drag: .init(insertionIndex: 1, blockDuration: 3)
        )
        #expect(positions[a] == 0)
        // Three seconds of room opens after the first clip.
        #expect(positions[b] == 7)
    }

    @Test func itCanArriveAtTheFront() {
        let positions = TimelineTrackLayout.positions(
            clips: clips,
            drag: .init(insertionIndex: 0, blockDuration: 3)
        )
        #expect(positions[a] == 3)
        #expect(positions[b] == 7)
    }

    @Test func itCanArriveAtTheEndWithoutMovingAnything() {
        let positions = TimelineTrackLayout.positions(
            clips: clips,
            drag: .init(insertionIndex: 2, blockDuration: 3)
        )
        #expect(positions[a] == 0)
        #expect(positions[b] == 4)
    }

    /// The regression: with no length of its own the gap opened nought seconds
    /// wide, so the arriving clip landed on top of the track instead of in it.
    @Test func withoutALengthNothingMoves() {
        let positions = TimelineTrackLayout.positions(
            clips: clips,
            drag: .init(insertionIndex: 1)
        )
        #expect(positions[b] == 4)
    }

    /// A plain reorder still measures itself, so passing the plan's length
    /// changes nothing for the case that already worked.
    @Test func aReorderIsUnaffected() {
        let withLength = TimelineTrackLayout.positions(
            clips: clips,
            drag: .init(movingIDs: [a], offset: 5, insertionIndex: 1, blockDuration: 4)
        )
        let measured = TimelineTrackLayout.positions(
            clips: clips,
            drag: .init(movingIDs: [a], offset: 5, insertionIndex: 1)
        )
        #expect(withLength == measured)
    }
}
