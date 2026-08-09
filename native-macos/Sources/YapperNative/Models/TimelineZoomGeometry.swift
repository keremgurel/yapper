import CoreGraphics
import Foundation

/// Pure zoom math for the timeline: how far a single input event moves the zoom
/// scale, and where the horizontal scroll offset has to land so the instant the
/// pointer sits on stays under the pointer.
enum TimelineZoomGeometry {
    static let scaleRange = 1.25 ... 320.0

    /// A single event may not multiply the scale by more than this. It only
    /// guards against absurd synthetic deltas; ordinary gestures never reach it.
    private static let perEventFactorRange = 0.5 ... 2.0

    /// Trackpads emit a long stream of small precise deltas, mouse wheels a few
    /// large line deltas. Both feed the same exponential curve, so a given
    /// physical distance always multiplies the zoom by the same amount and a
    /// gesture split across many events lands exactly where one big event would.
    static func scrollFactor(delta: CGFloat, hasPreciseDeltas: Bool) -> Double {
        let sensitivity = hasPreciseDeltas ? 0.0062 : 0.115
        return boundedFactor(exp(Double(delta) * sensitivity))
    }

    static func scaled(_ current: Double, by factor: Double) -> Double {
        min(scaleRange.upperBound, max(scaleRange.lowerBound, current * factor))
    }

    /// The scroll offset that keeps `pointerX` (in viewport coordinates) over
    /// the same point of the timeline after it resizes from `oldContentWidth` to
    /// `newContentWidth`.
    ///
    /// The anchor fraction is deliberately not clamped to 0...1: a pointer
    /// parked in the leading or trailing inset still resolves to a stable
    /// anchor, where clamping used to pin it to the first or last frame and let
    /// the clips drift out from under the cursor.
    static func anchoredOffset(
        oldOffset: CGFloat,
        pointerX: CGFloat,
        oldContentWidth: CGFloat,
        newContentWidth: CGFloat,
        viewportWidth: CGFloat,
        leadingInset: CGFloat = 0,
        trailingInset: CGFloat = 0
    ) -> CGFloat {
        guard oldContentWidth > 0, newContentWidth > 0 else { return 0 }
        let fraction = (oldOffset + pointerX - leadingInset) / oldContentWidth
        let proposed = leadingInset + fraction * newContentWidth - pointerX
        let documentWidth = leadingInset + newContentWidth + trailingInset
        return min(max(0, documentWidth - viewportWidth), max(0, proposed))
    }

    /// A raw trackpad pinch moves the timeline far less than the same spread
    /// moves a photo, so it gets amplified. An exponent is used rather than a
    /// multiplier because it composes exactly: raising every update of one
    /// gesture to this power equals raising the gesture's total scale to it.
    private static let pinchGain = 2.2

    /// `ratio` is the scale change since the previous update of a pinch.
    static func pinchFactor(ratio: Double) -> Double {
        guard ratio.isFinite, ratio > 0 else { return 1 }
        return boundedFactor(pow(ratio, pinchGain))
    }

    /// Pinch already reports a relative scale, so it only needs the bound.
    static func boundedFactor(_ factor: Double) -> Double {
        min(perEventFactorRange.upperBound, max(perEventFactorRange.lowerBound, factor))
    }
}
