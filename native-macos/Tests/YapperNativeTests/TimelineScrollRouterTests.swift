import Foundation
import Testing
@testable import YapperNative

struct TimelineScrollRouterTests {
    /// Two-finger scroll on a trackpad: an opening event with no movement, a run
    /// of `.changed` events, then the momentum glide.
    private static func gesture(
        deltaX: Double = 0,
        deltaY: Double = 0,
        commandHeld: Bool,
        steps: Int = 3
    ) -> [TimelineScrollRouter.Input] {
        var events = [event(commandHeld: commandHeld, startsGesture: true)]
        events += (0 ..< steps).map { _ in
            event(deltaX: deltaX, deltaY: deltaY, commandHeld: commandHeld)
        }
        events.append(event(commandHeld: commandHeld))              // fingers lifted
        events.append(
            event(deltaX: deltaX, deltaY: deltaY, commandHeld: commandHeld, endsGesture: true)
        )
        return events
    }

    private static func event(
        deltaX: Double = 0,
        deltaY: Double = 0,
        commandHeld: Bool = false,
        startsGesture: Bool = false,
        endsGesture: Bool = false,
        isContinuous: Bool = true
    ) -> TimelineScrollRouter.Input {
        TimelineScrollRouter.Input(
            deltaX: deltaX,
            deltaY: deltaY,
            hasPreciseDeltas: true,
            commandHeld: commandHeld,
            startsGesture: startsGesture,
            endsGesture: endsGesture,
            isContinuous: isContinuous
        )
    }

    private static func isZoom(_ outcome: TimelineScrollRouter.Outcome) -> Bool {
        if case .zoom = outcome { return true }
        return false
    }

    @Test func commandScrollOnlyZoomsAndNeverReachesTheTrackList() {
        var router = TimelineScrollRouter()
        let outcomes = Self.gesture(deltaY: -8, commandHeld: true).map { router.route($0) }

        #expect(outcomes.allSatisfy { $0 != .handOff })
        #expect(outcomes.contains(where: Self.isZoom))
    }

    @Test func plainScrollAfterACommandGestureScrollsTheTracksInstead() {
        var router = TimelineScrollRouter()
        for input in Self.gesture(deltaY: -8, commandHeld: true) { _ = router.route(input) }

        let outcomes = Self.gesture(deltaY: -8, commandHeld: false).map { router.route($0) }

        #expect(!outcomes.contains(where: Self.isZoom))
        #expect(outcomes.contains(.handOff))
    }

    @Test func releasingCommandPartWayThroughAGestureStopsZoomingWithoutScrolling() {
        var router = TimelineScrollRouter()
        _ = router.route(Self.event(commandHeld: true, startsGesture: true))
        #expect(Self.isZoom(router.route(Self.event(deltaY: -8, commandHeld: true))))

        // Key comes up while the fingers are still moving, and the momentum glide
        // that follows carries no modifier either.
        #expect(router.route(Self.event(deltaY: -8)) == .swallow)
        #expect(router.route(Self.event(deltaY: -6, endsGesture: true)) == .swallow)

        // The next gesture is a clean slate.
        #expect(router.route(Self.event(deltaY: -8, startsGesture: true)) == .handOff)
    }

    @Test func commandPressedPartWayThroughAPanTakesOverAsZoom() {
        var router = TimelineScrollRouter()
        _ = router.route(Self.event(startsGesture: true))
        #expect(router.route(Self.event(deltaY: -8)) == .handOff)
        #expect(Self.isZoom(router.route(Self.event(deltaY: -8, commandHeld: true))))
        // The rest of the gesture stays claimed even after the key comes up.
        #expect(router.route(Self.event(deltaY: -8)) == .swallow)
    }

    @Test func aGestureKeepsItsAxisEvenWhenTheSwipeDrifts() {
        var router = TimelineScrollRouter()
        _ = router.route(Self.event(startsGesture: true))
        #expect(router.route(Self.event(deltaX: -10, deltaY: -1)) == .pan(10))
        // Drifted vertical, but the gesture is already a horizontal pan.
        #expect(router.route(Self.event(deltaX: -1, deltaY: -9)) == .pan(1))
    }

    /// A two-finger drag is never perfectly vertical. Reading whichever axis
    /// happened to be larger on each event made the small ones flip axis, and
    /// the two axes do not agree about which way is "in", so a steady drag
    /// zoomed in and back out again.
    @Test func aZoomKeepsItsAxisEvenWhenTheSwipeDrifts() {
        var router = TimelineScrollRouter()
        _ = router.route(Self.event(commandHeld: true, startsGesture: true))
        guard case .zoom(let first) = router.route(
            Self.event(deltaX: -1, deltaY: -10, commandHeld: true)
        ) else {
            Issue.record("expected a zoom")
            return
        }
        // Drifted onto the other axis, and by the opposite sign. The gesture is
        // already reading the vertical one, so it keeps going the same way.
        guard case .zoom(let second) = router.route(
            Self.event(deltaX: 9, deltaY: -1, commandHeld: true)
        ) else {
            Issue.record("expected a zoom")
            return
        }
        #expect((first - 1).sign == (second - 1).sign)
    }

    /// Every scroll event with Command down belongs to the zoom, including the
    /// opening one that carries no movement yet. None of them may reach the
    /// track list.
    @Test func nothingWithCommandHeldEverReachesTheTrackList() {
        var router = TimelineScrollRouter()
        for event in Self.gesture(deltaY: -6, commandHeld: true) {
            #expect(router.route(event) != .handOff)
        }
    }

    @Test func aMouseWheelDecidesEveryClickOnItsOwn() {
        var router = TimelineScrollRouter()
        let zoomClick = Self.event(deltaY: -3, commandHeld: true, isContinuous: false)
        #expect(Self.isZoom(router.route(zoomClick)))

        // No phases to latch onto, so the very next click without the key must
        // fall straight through to the track list.
        let plainClick = Self.event(deltaY: -3, isContinuous: false)
        #expect(router.route(plainClick) == .handOff)
    }
}
