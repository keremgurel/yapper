import Foundation

/// Decides what one scroll-wheel event means for the timeline: zoom, horizontal
/// pan, or nothing at all so the track list keeps scrolling.
///
/// This is the whole rule set for the interaction, kept free of AppKit so every
/// branch is testable. `TimelineScrollInputView` only translates `NSEvent` into
/// `Input` and applies the outcome.
///
/// The rules, in order:
///
/// 1. Command held means zoom, whatever the gesture was doing a moment ago.
/// 2. A gesture that was zooming and then loses Command stops right there. Its
///    remaining events are swallowed rather than handed to the track list, so
///    letting go part-way through a flick never turns into a vertical jump.
/// 3. Everything else pans horizontally or falls through to the track list, with
///    the axis picked once per gesture.
struct TimelineScrollRouter {
    enum Outcome: Equatable {
        /// Zoom by this factor and consume the event.
        case zoom(Double)
        /// Change the horizontal scroll offset by this much and consume the event.
        case pan(Double)
        /// Consume the event and do nothing.
        case swallow
        /// Leave the event alone; the track list scrolls with it.
        case handOff
    }

    struct Input {
        var deltaX: Double
        var deltaY: Double
        var hasPreciseDeltas: Bool
        var commandHeld: Bool
        /// Fingers landed: `.mayBegin` or `.began`.
        var startsGesture: Bool
        /// Fingers lifted and the glide is over: `.cancelled` or momentum `.ended`.
        var endsGesture: Bool
        /// A trackpad or Magic Mouse gesture, i.e. the event carries a phase.
        /// Plain mouse-wheel clicks arrive without one and never latch.
        var isContinuous: Bool
    }

    private enum Claim: Equatable {
        /// A zoom, and which axis it is reading, picked once when the gesture
        /// first moves far enough to tell.
        case zoom(PanAxis?)
        case pan(PanAxis?)
    }

    private enum PanAxis {
        case horizontal
        case vertical
    }

    /// What the in-flight gesture was claimed for, `nil` between gestures.
    private var claim: Claim?

    mutating func route(_ input: Input) -> Outcome {
        // A fresh gesture never inherits the last one's claim. Clearing here as
        // well as at the end matters because a gesture that ends without a
        // momentum glide has no closing event to clear it.
        if input.startsGesture { claim = nil }
        defer {
            if input.endsGesture || !input.isContinuous { claim = nil }
        }

        if input.commandHeld { return zoom(input) }

        // Command is gone but this gesture started as a zoom. Trackpads keep
        // sending `.changed` events after the key is released and momentum
        // events after the fingers leave; neither belongs to the track list.
        if case .zoom = claim { return .swallow }

        return pan(input)
    }

    /// Zooming reads one axis for the whole gesture.
    ///
    /// Taking whichever axis was larger on each event on its own is what made
    /// Command-scroll jitter: a two-finger drag is never perfectly vertical, so
    /// on the small events the dominant axis flipped, and the two axes do not
    /// agree about which way is "in". Picking once and keeping it makes the
    /// gesture go one way.
    private mutating func zoom(_ input: Input) -> Outcome {
        let axis: PanAxis?
        if case .zoom(let locked?) = claim {
            axis = locked
        } else if abs(input.deltaY) > 0.01 || abs(input.deltaX) > 0.01 {
            axis = abs(input.deltaY) >= abs(input.deltaX) ? .vertical : .horizontal
            claim = .zoom(input.isContinuous ? axis : nil)
        } else {
            // The opening events carry no movement yet. Still a zoom, so the
            // event is claimed, but there is nothing to zoom by.
            claim = .zoom(nil)
            axis = nil
        }

        guard let axis else { return .swallow }
        let delta = axis == .vertical ? input.deltaY : input.deltaX
        return .zoom(
            TimelineZoomGeometry.scrollFactor(
                delta: delta,
                hasPreciseDeltas: input.hasPreciseDeltas
            )
        )
    }

    /// Horizontal intent pans the timeline; vertical intent is handed back so
    /// the track list keeps scrolling the way it always has.
    ///
    /// A continuous gesture picks its axis once and keeps it. Judging every
    /// event on its own made a slightly diagonal two-finger swipe alternate
    /// between panning and scrolling the tracks.
    private mutating func pan(_ input: Input) -> Outcome {
        let lineHeight = input.hasPreciseDeltas ? 1.0 : 16.0
        let deltaX = input.deltaX * lineHeight
        let deltaY = input.deltaY * lineHeight

        let axis: PanAxis
        if case .pan(let locked?) = claim {
            axis = locked
        } else {
            // The opening events of a gesture carry no movement yet, so there is
            // nothing to read an axis from.
            guard abs(deltaX) > 0.01 || abs(deltaY) > 0.01 else { return .handOff }
            axis = abs(deltaX) > abs(deltaY) ? .horizontal : .vertical
            if input.isContinuous { claim = .pan(axis) }
        }

        guard axis == .horizontal else { return .handOff }
        return .pan(-deltaX)
    }
}
