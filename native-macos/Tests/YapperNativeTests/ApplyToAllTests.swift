import Foundation
import Testing
@testable import YapperNative

/// What a copy onto every clip does and, more to the point, what it leaves
/// alone.
///
/// A finished edit is dozens of clips that were one recording, so wanting them
/// framed alike is the normal case. Wanting them keyframed alike never is: a
/// move is two moments and the line between them, and the clip three cuts later
/// has no use for the same one.
struct ApplyToAllTests {
    private let mediaID = UUID()

    private func clip(
        _ start: Double,
        _ end: Double,
        framing: VideoFraming? = nil,
        keys: [FramingKey]? = nil,
        backgroundRemoved: Bool? = nil
    ) -> TimelineClip {
        TimelineClip(
            mediaID: mediaID,
            sourceStart: start,
            sourceEnd: end,
            framing: framing,
            framingKeys: keys,
            backgroundRemoved: backgroundRemoved
        )
    }

    private func overlay(
        x: Double,
        y: Double,
        width: Double,
        height: Double,
        start: Double = 0,
        lane: Int? = nil,
        keys: [OverlayKey]? = nil
    ) -> ProjectOverlay {
        ProjectOverlay(
            mediaID: mediaID,
            timelineStart: start,
            duration: 2,
            x: x,
            y: y,
            width: width,
            height: height,
            track: lane,
            keys: keys
        )
    }

    // MARK: - Framing

    @Test("Framing lands on every clip")
    func framingSpreads() {
        let framing = VideoFraming(scale: 1.4, x: 0.1, y: 0)
        let after = ApplyToAll.framing(framing, to: [clip(0, 5), clip(5, 10), clip(10, 15)])
        #expect(after.allSatisfy { $0.resolvedFraming == framing })
    }

    /// The thing one button for everything gets wrong. A keyed clip's framing
    /// is the result of its keys, so writing one is either ignored or takes the
    /// move out.
    @Test("A keyframed clip keeps its move")
    func keyedClipsAreLeftAlone() {
        let keyed = clip(
            5,
            10,
            keys: [
                FramingKey(at: 5, framing: .identity),
                FramingKey(at: 9, framing: VideoFraming(scale: 1.8, x: 0, y: 0)),
            ]
        )
        let after = ApplyToAll.framing(
            VideoFraming(scale: 1.4, x: 0.1, y: 0),
            to: [clip(0, 5), keyed]
        )
        #expect(after.last == keyed)
        #expect(VideoFramingTrack.isKeyed(try! #require(after.last)))
    }

    /// Framing back to where it started is stored as nothing at all, so a
    /// project nobody has framed reads exactly as it did before.
    @Test("Framing that changes nothing is stored as nothing")
    func identityIsStoredAsNil() {
        let after = ApplyToAll.framing(
            .identity,
            to: [clip(0, 5, framing: VideoFraming(scale: 1.4, x: 0, y: 0))]
        )
        #expect(after.first?.framing == nil)
    }

    // MARK: - The other groups

    @Test("Background removal lands on every clip")
    func backgroundSpreads() {
        let after = ApplyToAll.background(removed: true, to: [clip(0, 5), clip(5, 10)])
        #expect(after.allSatisfy { $0.removesBackground })
        let back = ApplyToAll.background(removed: false, to: after)
        #expect(back.allSatisfy { !$0.removesBackground })
        #expect(back.allSatisfy { $0.backgroundRemoved == nil })
    }

    /// Each copies its own group and no other, which is the whole reason there
    /// is more than one of them.
    @Test("Copying one group leaves the others where they were")
    func groupsAreIndependent() {
        let busy = clip(5, 10, backgroundRemoved: true)
        let after = ApplyToAll.framing(VideoFraming(scale: 1.4, x: 0, y: 0), to: [busy])
        let only = try! #require(after.first)
        #expect(only.resolvedFraming.scale == 1.4)
        #expect(only.removesBackground)
    }

    // MARK: - Overlays

    @Test("Size and position land on the overlays sharing a lane")
    func overlayFramesSpreadAcrossALane() {
        let placed = overlay(x: 0.1, y: 0.2, width: 0.4, height: 0.3)
        let neighbour = overlay(x: 0.7, y: 0.7, width: 0.2, height: 0.15, start: 3)
        let after = ApplyToAll.frame(of: placed, to: [placed, neighbour], scope: .lane)
        let moved = try! #require(after.last)
        #expect(moved.x == 0.1)
        #expect(moved.y == 0.2)
        #expect(moved.width == 0.4)
        #expect(moved.height == 0.3)
    }

    /// The reason the reach is a choice: a lane of inserts wants to match
    /// itself and usually does not want to drag the lane above it along.
    @Test("A lane copy leaves the other lanes alone")
    func laneScopeStopsAtItsOwnLane() {
        let placed = overlay(x: 0.1, y: 0.2, width: 0.4, height: 0.3)
        let elsewhere = overlay(x: 0.7, y: 0.7, width: 0.2, height: 0.15, start: 3, lane: 1)
        let after = ApplyToAll.frame(of: placed, to: [placed, elsewhere], scope: .lane)
        #expect(after.last == elsewhere)
    }

    @Test("A project copy reaches across every lane")
    func projectScopeCrossesLanes() {
        let placed = overlay(x: 0.1, y: 0.2, width: 0.4, height: 0.3)
        let elsewhere = overlay(x: 0.7, y: 0.7, width: 0.2, height: 0.15, start: 3, lane: 1)
        let moved = try! #require(
            ApplyToAll.frame(of: placed, to: [placed, elsewhere], scope: .project).last
        )
        #expect(moved.x == 0.1)
        #expect(moved.width == 0.4)
    }

    /// Its timing and its lane are what make it a different overlay rather than
    /// a copy of the first one.
    @Test("An overlay keeps its timing and its lane")
    func overlaysKeepWhatMakesThemThemselves() {
        let placed = overlay(x: 0.1, y: 0.2, width: 0.4, height: 0.3)
        let elsewhere = overlay(x: 0.7, y: 0.7, width: 0.2, height: 0.15, start: 3, lane: 1)
        let moved = try! #require(
            ApplyToAll.frame(of: placed, to: [placed, elsewhere], scope: .project).last
        )
        #expect(moved.timelineStart == 3)
        #expect(moved.lane == 1)
        #expect(moved.id == elsewhere.id)
    }

    @Test("A keyframed overlay keeps its move")
    func keyedOverlaysAreLeftAlone() {
        let placed = overlay(x: 0.1, y: 0.2, width: 0.4, height: 0.3)
        let keyed = overlay(
            x: 0.7,
            y: 0.7,
            width: 0.2,
            height: 0.15,
            keys: [
                OverlayKey(at: 0, box: OverlayBox(x: 0.7, y: 0.7, width: 0.2, height: 0.15)),
                OverlayKey(at: 1, box: OverlayBox(x: 0.2, y: 0.2, width: 0.2, height: 0.15)),
            ]
        )
        let after = ApplyToAll.frame(of: placed, to: [placed, keyed], scope: .lane)
        #expect(after.last == keyed)
    }

    /// The number on the menu item and the number that moves are the same
    /// number, which is the only reason the item can promise anything.
    @Test("What the menu counts is what the copy changes")
    func targetsMatchWhatMoves() {
        let placed = overlay(x: 0.1, y: 0.2, width: 0.4, height: 0.3)
        let neighbour = overlay(x: 0.7, y: 0.7, width: 0.2, height: 0.15, start: 3)
        let upstairs = overlay(x: 0.5, y: 0.5, width: 0.2, height: 0.15, start: 3, lane: 1)
        let all = [placed, neighbour, upstairs]

        for scope in [ApplyToAll.OverlayScope.lane, .project] {
            let counted = ApplyToAll.targets(from: placed, in: all, scope: scope).count
            let after = ApplyToAll.frame(of: placed, to: all, scope: scope)
            #expect(ApplyToAll.changeCount(from: all, to: after) == counted)
        }
    }

    @Test("An overlay is never a target of itself")
    func theSourceIsNotATarget() {
        let placed = overlay(x: 0.1, y: 0.2, width: 0.4, height: 0.3)
        #expect(ApplyToAll.targets(from: placed, in: [placed], scope: .project).isEmpty)
    }

    /// A keyed overlay is not going to move, so counting it would put a number
    /// on the menu that the copy could not deliver.
    @Test("Keyframed overlays are not counted as targets")
    func keyedOverlaysAreNotCounted() {
        let placed = overlay(x: 0.1, y: 0.2, width: 0.4, height: 0.3)
        let keyed = overlay(
            x: 0.7,
            y: 0.7,
            width: 0.2,
            height: 0.15,
            keys: [
                OverlayKey(at: 0, box: OverlayBox(x: 0.7, y: 0.7, width: 0.2, height: 0.15)),
                OverlayKey(at: 1, box: OverlayBox(x: 0.2, y: 0.2, width: 0.2, height: 0.15)),
            ]
        )
        #expect(ApplyToAll.targets(from: placed, in: [placed, keyed], scope: .lane).isEmpty)
    }

    // MARK: - Counting

    @Test("What is reported is what actually moved")
    func onlyRealChangesAreCounted() {
        let framing = VideoFraming(scale: 1.4, x: 0, y: 0)
        let already = clip(0, 5, framing: framing)
        let clips = [already, clip(5, 10), clip(10, 15)]
        let after = ApplyToAll.framing(framing, to: clips)
        #expect(ApplyToAll.changeCount(from: clips, to: after) == 2)
    }

    @Test("A copy that changes nothing counts nothing")
    func nothingToDoCountsZero() {
        let clips = [clip(0, 5), clip(5, 10)]
        #expect(ApplyToAll.changeCount(from: clips, to: clips) == 0)
    }
}
