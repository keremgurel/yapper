import CoreGraphics
import Foundation

/// Where the floating assistant is pinned.
///
/// Stored as a point in the editor's own space rather than a corner, so it goes
/// exactly where it was put. Resizing the window pulls it back inside rather
/// than leaving it stranded off the edge.
struct AssistantAnchor: Equatable, Codable, Sendable {
    var x: Double
    var y: Double

    /// How close to the edge it may sit. Enough that the shadow is not clipped
    /// and the grab area never falls off the window.
    static let margin: Double = 16

    static func clamped(
        _ anchor: AssistantAnchor,
        size: CGSize,
        within bounds: CGSize
    ) -> AssistantAnchor {
        // A window smaller than the thing being placed has nowhere legal to put
        // it, so the margin gives way rather than inverting the range.
        let maximumX = max(Self.margin, bounds.width - size.width - Self.margin)
        let maximumY = max(Self.margin, bounds.height - size.height - Self.margin)
        return AssistantAnchor(
            x: min(maximumX, max(Self.margin, anchor.x)),
            y: min(maximumY, max(Self.margin, anchor.y))
        )
    }

    /// Where it sits before it has ever been dragged: bottom right, out of the
    /// way of the timeline's own controls.
    static func initial(size: CGSize, within bounds: CGSize) -> AssistantAnchor {
        clamped(
            AssistantAnchor(
                x: bounds.width - size.width - margin,
                y: bounds.height - size.height - margin
            ),
            size: size,
            within: bounds
        )
    }

    /// Keeps the same edge it was nearest to when the panel grows or shrinks, so
    /// opening it does not throw it across the window.
    static func keepingEdges(
        _ anchor: AssistantAnchor,
        oldSize: CGSize,
        newSize: CGSize,
        within bounds: CGSize
    ) -> AssistantAnchor {
        let wasNearerRight = anchor.x + oldSize.width / 2 > bounds.width / 2
        let wasNearerBottom = anchor.y + oldSize.height / 2 > bounds.height / 2
        return clamped(
            AssistantAnchor(
                x: wasNearerRight ? anchor.x + oldSize.width - newSize.width : anchor.x,
                y: wasNearerBottom ? anchor.y + oldSize.height - newSize.height : anchor.y
            ),
            size: newSize,
            within: bounds
        )
    }
}

/// Where the assistant was last put, and how big it was when it was put there.
///
/// The size travels with the anchor because the two only mean anything
/// together: the same corner of the window is a different top-left for a 62pt
/// bubble than for a 560pt panel. Keeping them as one value is what lets the
/// conversion between the two happen while the thing is being drawn, instead of
/// a frame later.
struct AssistantPlacement: Equatable, Sendable {
    var anchor: AssistantAnchor
    var size: CGSize

    /// Where something of `size` sits now, given where it was last put.
    ///
    /// Growing and shrinking used to be a second step: set the flag, render,
    /// then move the anchor to match afterwards. That is one frame in the wrong
    /// place followed by a slide into the right one. Worked out here, the size
    /// and the position change together in one pass, and it simply grows out of
    /// the corner it was already in.
    static func anchor(
        for size: CGSize,
        lastPut placement: AssistantPlacement?,
        within bounds: CGSize
    ) -> AssistantAnchor {
        guard let placement else {
            return AssistantAnchor.initial(size: size, within: bounds)
        }
        guard placement.size != size else { return placement.anchor }
        return AssistantAnchor.keepingEdges(
            placement.anchor,
            oldSize: placement.size,
            newSize: size,
            within: bounds
        )
    }
}
