import CoreGraphics
import Foundation
import Testing
@testable import YapperNative

/// A punch-in is two keys and the line between them. These pin down what that
/// line is, because everything else — the canvas, the panel, the export — reads
/// the answer from here.
struct FramingKeyTests {
    private func clip(_ keys: [FramingKey] = [], sourceStart: Double = 0) -> TimelineClip {
        TimelineClip(
            mediaID: UUID(),
            sourceStart: sourceStart,
            sourceEnd: sourceStart + 10,
            framingKeys: keys.isEmpty ? nil : keys
        )
    }

    private func framing(_ scale: Double, x: Double = 0, y: Double = 0) -> VideoFraming {
        VideoFraming(scale: scale, x: x, y: y)
    }

    @Test func aClipWithNoKeysIsFramedTheWayItAlwaysWas() {
        var still = clip()
        still.framing = framing(1.4)
        #expect(VideoFramingTrack.framing(of: still, atSource: 3) == framing(1.4))
        #expect(!VideoFramingTrack.isKeyed(still))
    }

    @Test func aMoveIsAStraightLineBetweenItsKeys() {
        let keyed = clip([
            FramingKey(at: 2, framing: framing(1)),
            FramingKey(at: 4, framing: framing(2)),
        ])
        #expect(VideoFramingTrack.framing(of: keyed, atSource: 2).scale == 1)
        #expect(VideoFramingTrack.framing(of: keyed, atSource: 3).scale == 1.5)
        #expect(VideoFramingTrack.framing(of: keyed, atSource: 4).scale == 2)
    }

    @Test func theOffsetTravelsWithTheZoom() {
        let keyed = clip([
            FramingKey(at: 0, framing: framing(1, x: 0, y: 0)),
            FramingKey(at: 2, framing: framing(1, x: 0.4, y: -0.2)),
        ])
        let middle = VideoFramingTrack.framing(of: keyed, atSource: 1)
        #expect(abs(middle.x - 0.2) < 1e-9)
        #expect(abs(middle.y - -0.1) < 1e-9)
    }

    /// A push-in that ends at 140% stays at 140%. Drifting back on its own is
    /// the one thing a creator never asked for.
    @Test func aMoveHoldsAtBothEnds() {
        let keyed = clip([
            FramingKey(at: 2, framing: framing(1)),
            FramingKey(at: 4, framing: framing(2)),
        ])
        #expect(VideoFramingTrack.framing(of: keyed, atSource: 0).scale == 1)
        #expect(VideoFramingTrack.framing(of: keyed, atSource: 9).scale == 2)
    }

    @Test func oneKeyIsAStateRatherThanAMove() {
        let keyed = clip([FramingKey(at: 5, framing: framing(1.6))])
        #expect(VideoFramingTrack.framing(of: keyed, atSource: 0).scale == 1.6)
        #expect(VideoFramingTrack.framing(of: keyed, atSource: 9).scale == 1.6)
    }

    // MARK: - Making one

    /// Pressing the diamond must never change the picture: the whole gesture is
    /// "mark here, move there, change it", and a first key that moved something
    /// would break the first half.
    @Test func theFirstKeyTakesTheFramingTheClipAlreadyHad() {
        var still = clip()
        still.framing = framing(1.3)
        let keyed = VideoFramingTrack.setting(framing(1.3), atSource: 2, in: still)

        #expect(VideoFramingTrack.keys(of: keyed).count == 1)
        #expect(VideoFramingTrack.framing(of: keyed, atSource: 7) == framing(1.3))
    }

    @Test func aSecondKeyMakesItAMove() {
        var still = clip()
        still.framing = framing(1)
        let first = VideoFramingTrack.setting(framing(1), atSource: 0, in: still)
        let move = VideoFramingTrack.setting(framing(1.5), atSource: 2, in: first)

        #expect(VideoFramingTrack.keys(of: move).count == 2)
        #expect(VideoFramingTrack.framing(of: move, atSource: 1).scale == 1.25)
    }

    @Test func settingAKeyWhereOneAlreadyIsReplacesIt() {
        let keyed = clip([FramingKey(at: 2, framing: framing(1))])
        let updated = VideoFramingTrack.setting(framing(1.8), atSource: 2.001, in: keyed)
        #expect(VideoFramingTrack.keys(of: updated).count == 1)
        #expect(VideoFramingTrack.keys(of: updated).first?.framing == framing(1.8))
    }

    @Test func keysAreKeptInTheOrderTheyAreReached() {
        var built = clip()
        built = VideoFramingTrack.setting(framing(2), atSource: 6, in: built)
        built = VideoFramingTrack.setting(framing(1), atSource: 1, in: built)
        #expect(VideoFramingTrack.keys(of: built).map(\.at) == [1, 6])
    }

    // MARK: - Taking one away

    @Test func removingTheLastKeyLeavesThePictureWhereThatKeyHadIt() {
        let keyed = clip([FramingKey(at: 3, framing: framing(1.7))])
        let bare = VideoFramingTrack.removingKey(atSource: 3, in: keyed)

        #expect(!VideoFramingTrack.isKeyed(bare))
        #expect(bare.resolvedFraming == framing(1.7))
    }

    @Test func clearingKeysHoldsWhatIsOnScreenAtThatMoment() {
        let keyed = clip([
            FramingKey(at: 0, framing: framing(1)),
            FramingKey(at: 4, framing: framing(2)),
        ])
        let flat = VideoFramingTrack.clearingKeys(atSource: 2, in: keyed)
        #expect(!VideoFramingTrack.isKeyed(flat))
        #expect(flat.resolvedFraming.scale == 1.5)
    }

    // MARK: - Walking between them

    @Test func theArrowsFindTheKeysEitherSide() {
        let keyed = clip([
            FramingKey(at: 1, framing: framing(1)),
            FramingKey(at: 5, framing: framing(2)),
        ])
        #expect(VideoFramingTrack.previousKey(of: keyed, before: 3)?.at == 1)
        #expect(VideoFramingTrack.nextKey(of: keyed, after: 3)?.at == 5)
        #expect(VideoFramingTrack.previousKey(of: keyed, before: 1) == nil)
        #expect(VideoFramingTrack.nextKey(of: keyed, after: 5) == nil)
    }

    /// Standing exactly on a key, the arrows point at the others rather than at
    /// the one under your feet.
    @Test func standingOnAKeyIsNotStandingBeforeOrAfterIt() {
        let keyed = clip([
            FramingKey(at: 1, framing: framing(1)),
            FramingKey(at: 5, framing: framing(2)),
        ])
        #expect(VideoFramingTrack.key(of: keyed, atSource: 5)?.at == 5)
        #expect(VideoFramingTrack.nextKey(of: keyed, after: 5) == nil)
        #expect(VideoFramingTrack.previousKey(of: keyed, before: 5)?.at == 1)
    }

    // MARK: - Surviving a save

    @Test func aMoveSurvivesASaveAndAReload() throws {
        let keyed = clip([
            FramingKey(at: 1, framing: framing(1)),
            FramingKey(at: 3, framing: framing(1.6, x: 0.1)),
        ])
        let restored = try JSONDecoder().decode(
            TimelineClip.self,
            from: JSONEncoder().encode(keyed)
        )
        #expect(VideoFramingTrack.keys(of: restored) == VideoFramingTrack.keys(of: keyed))
        #expect(VideoFramingTrack.framing(of: restored, atSource: 2).scale == 1.3)
    }

    /// Keys are stored in the media's own seconds, so trimming the head leaves a
    /// punch-in aimed at the gesture it was aimed at.
    @Test func trimmingTheHeadDoesNotDragTheMoveWithIt() {
        var keyed = clip([FramingKey(at: 6, framing: framing(2))], sourceStart: 4)
        keyed.sourceStart = 5
        #expect(VideoFramingTrack.key(of: keyed, atSource: 6)?.framing == framing(2))
    }
}

/// The instruction boundaries a move needs. AVFoundation ramps between two
/// transforms and no further, so every key has to end an instruction.
struct FramingKeyBoundaryTests {
    @Test func everyKeyIsABoundary() {
        let boundaries = OverlayCompositionPlan.boundaries(
            clipEnds: [10],
            overlays: [],
            duration: 10,
            keyframes: [2, 6]
        )
        #expect(boundaries.contains(2))
        #expect(boundaries.contains(6))
    }

    @Test func aKeyOnTopOfACutIsOneBoundary() {
        let boundaries = OverlayCompositionPlan.boundaries(
            clipEnds: [4, 10],
            overlays: [],
            duration: 10,
            keyframes: [4]
        )
        #expect(boundaries.filter { abs($0 - 4) < 0.001 }.count == 1)
    }

    @Test func keysOutsideTheVideoAreHeldInside() {
        let boundaries = OverlayCompositionPlan.boundaries(
            clipEnds: [10],
            overlays: [],
            duration: 10,
            keyframes: [-3, 40]
        )
        #expect(boundaries.allSatisfy { $0 >= 0 && $0 <= 10 })
    }
}

/// The cutaway half of keyframing. Deliberately the same rules as the video
/// track's, so the two behave identically.
struct OverlayKeyTests {
    private func overlay(_ keys: [OverlayKey] = []) -> ProjectOverlay {
        ProjectOverlay(
            mediaID: UUID(),
            timelineStart: 10,
            duration: 4,
            keys: keys.isEmpty ? nil : keys
        )
    }

    private func box(_ x: Double, width: Double = 0.4) -> OverlayBox {
        OverlayBox(x: x, y: 0.1, width: width, height: 0.3)
    }

    @Test func anUnkeyedCutawayHoldsTheBoxItWasGiven() {
        var still = overlay()
        still.x = 0.2
        #expect(OverlayKeyTrack.box(of: still, at: 2).x == 0.2)
        #expect(!OverlayKeyTrack.isKeyed(still))
    }

    @Test func aMoveIsAStraightLineBetweenItsKeys() {
        let keyed = overlay([
            OverlayKey(at: 0, box: box(0)),
            OverlayKey(at: 2, box: box(0.4)),
        ])
        #expect(OverlayKeyTrack.box(of: keyed, at: 1).x == 0.2)
        #expect(OverlayKeyTrack.box(of: keyed, at: 0).x == 0)
        #expect(OverlayKeyTrack.box(of: keyed, at: 2).x == 0.4)
    }

    @Test func sizeTravelsWithPosition() {
        let keyed = overlay([
            OverlayKey(at: 0, box: box(0, width: 0.2)),
            OverlayKey(at: 2, box: box(0, width: 0.6)),
        ])
        #expect(OverlayKeyTrack.box(of: keyed, at: 1).width == 0.4)
    }

    /// Keys are seconds from the cutaway's own start, so the timeline reading
    /// has to offset by where the cutaway sits.
    @Test func timelineSecondsAreConvertedToTheCutawaysOwn() {
        let keyed = overlay([
            OverlayKey(at: 0, box: box(0)),
            OverlayKey(at: 2, box: box(0.4)),
        ])
        #expect(OverlayKeyTrack.box(of: keyed, atTimeline: 11).x == 0.2)
        // Before it starts and after it ends, it holds.
        #expect(OverlayKeyTrack.box(of: keyed, atTimeline: 5).x == 0)
        #expect(OverlayKeyTrack.box(of: keyed, atTimeline: 99).x == 0.4)
    }

    @Test func theFirstKeyTakesTheBoxItAlreadyHad() {
        var still = overlay()
        still.x = 0.25
        let keyed = OverlayKeyTrack.setting(
            OverlayBox(x: still.x, y: still.y, width: still.width, height: still.height),
            at: 1,
            in: still
        )
        #expect(OverlayKeyTrack.keys(of: keyed).count == 1)
        #expect(OverlayKeyTrack.box(of: keyed, at: 3).x == 0.25)
    }

    @Test func removingTheLastKeyLeavesTheCardWhereThatKeyHadIt() {
        let keyed = overlay([OverlayKey(at: 1, box: box(0.33))])
        let bare = OverlayKeyTrack.removingKey(at: 1, in: keyed)
        #expect(!OverlayKeyTrack.isKeyed(bare))
        #expect(bare.x == 0.33)
    }

    // MARK: - Dragging one

    @Test func aKeyCanBeMovedAlongTheCutaway() {
        let keyed = overlay([
            OverlayKey(at: 0, box: box(0)),
            OverlayKey(at: 2, box: box(0.4)),
        ])
        let moved = OverlayKeyTrack.movingKey(at: 2, to: 3.5, in: keyed)
        #expect(OverlayKeyTrack.keys(of: moved).map(\.at) == [0, 3.5])
    }

    /// A drag can neither reorder a move nor stack two keys on one moment.
    @Test func aDraggedKeyStaysBetweenItsNeighbours() {
        let keyed = overlay([
            OverlayKey(at: 0, box: box(0)),
            OverlayKey(at: 2, box: box(0.4)),
            OverlayKey(at: 3, box: box(0.6)),
        ])
        let pastNext = OverlayKeyTrack.movingKey(at: 2, to: 9, in: keyed)
        let times = OverlayKeyTrack.keys(of: pastNext).map(\.at)
        #expect(times[1] < times[2])
        #expect(times[1] <= 3 - OverlayKeyTrack.minimumGap + 1e-9)

        let beforeFirst = OverlayKeyTrack.movingKey(at: 2, to: -5, in: keyed)
        #expect(OverlayKeyTrack.keys(of: beforeFirst).map(\.at)[1] >= OverlayKeyTrack.minimumGap)
    }

    @Test func aKeyCannotBeDraggedPastTheEndOfItsCard() {
        let keyed = overlay([OverlayKey(at: 1, box: box(0))])
        let moved = OverlayKeyTrack.movingKey(at: 1, to: 40, in: keyed)
        #expect(OverlayKeyTrack.keys(of: moved).first?.at == 4)
    }

    @Test func aMoveSurvivesASaveAndAReload() throws {
        let keyed = overlay([
            OverlayKey(at: 0, box: box(0)),
            OverlayKey(at: 2, box: box(0.4)),
        ])
        let restored = try JSONDecoder().decode(
            ProjectOverlay.self,
            from: JSONEncoder().encode(keyed)
        )
        #expect(OverlayKeyTrack.box(of: restored, at: 1).x == 0.2)
    }
}
