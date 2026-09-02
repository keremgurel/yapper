import CoreGraphics
import Foundation

/// Which side of the crop rectangle a drag has hold of.
enum CropEdge: CaseIterable, Equatable, Sendable {
    case top
    case bottom
    case leading
    case trailing

    var isHorizontal: Bool { self == .leading || self == .trailing }

    /// Which way the edge moves the side it belongs to. Dragging the leading
    /// edge right takes width away; dragging the trailing edge right adds it.
    var sign: Double { self == .top || self == .leading ? -1 : 1 }

    var accessibilityName: String {
        switch self {
        case .top: "top"
        case .bottom: "bottom"
        case .leading: "left"
        case .trailing: "right"
        }
    }
}

/// Dragging the crop rectangle around: moving it, resizing it from a corner or
/// an edge, and holding it to a shape while that happens.
///
/// Everything is in the source's own fractions with the origin at its top left,
/// which is what `OverlayCrop` is. Pure arithmetic, so all of it is testable
/// without a picture.
///
/// Aspect ratios arrive here already converted into a *fraction* ratio: a
/// rectangle of `w` by `h` fractions of a picture that is `sourceAspect` wide
/// per tall has a real shape of `sourceAspect * w / h`, so holding a real ratio
/// `R` means holding `w / h` at `R / sourceAspect`. Doing that conversion once,
/// at the edge, keeps every rule below in one space.
enum CropGeometry {
    /// The fraction ratio that gives a rectangle the real shape `ratio`.
    static func fractionRatio(forRealRatio ratio: Double, sourceAspect: Double) -> Double? {
        guard ratio > 0, sourceAspect > 0 else { return nil }
        return ratio / sourceAspect
    }

    static func moved(
        _ crop: OverlayCrop,
        dx: Double,
        dy: Double,
        minimumSide: Double
    ) -> OverlayCrop {
        contained(
            OverlayCrop(x: crop.x + dx, y: crop.y + dy, width: crop.width, height: crop.height),
            ratio: nil,
            minimumSide: minimumSide
        )
    }

    /// The rectangle resized from one corner, with the opposite corner left
    /// exactly where it was.
    static func resized(
        _ crop: OverlayCrop,
        corner: CanvasResizeCorner,
        dx: Double,
        dy: Double,
        ratio: Double?,
        minimumSide: Double
    ) -> OverlayCrop {
        var width = crop.width + dx * corner.xSign
        var height = crop.height + dy * corner.ySign

        if let ratio, ratio > 0 {
            // One diagonal, one size. Averaging the two axes is what keeps a
            // locked corner drag from lurching whenever the pointer wanders off
            // the diagonal it is supposed to be following.
            let fromWidth = width
            let fromHeight = height * ratio
            width = (fromWidth + fromHeight) / 2
            height = width / ratio
        }

        return anchored(
            crop,
            width: width,
            height: height,
            keepingRight: corner.xSign < 0,
            keepingBottom: corner.ySign < 0,
            ratio: ratio,
            minimumSide: minimumSide
        )
    }

    /// The rectangle resized from one side, with the opposite side left where
    /// it was.
    ///
    /// Under a locked shape the other axis has to move too, and it grows about
    /// the rectangle's own centre, so trimming a messy left edge does not also
    /// slide the picture up or down.
    static func resized(
        _ crop: OverlayCrop,
        edge: CropEdge,
        delta: Double,
        ratio: Double?,
        minimumSide: Double
    ) -> OverlayCrop {
        var width = crop.width
        var height = crop.height
        if edge.isHorizontal {
            width += delta * edge.sign
            if let ratio, ratio > 0 { height = width / ratio }
        } else {
            height += delta * edge.sign
            if let ratio, ratio > 0 { width = height * ratio }
        }

        var updated = anchored(
            crop,
            width: width,
            height: height,
            keepingRight: edge == .leading,
            keepingBottom: edge == .top,
            ratio: ratio,
            minimumSide: minimumSide
        )
        // The axis the drag did not touch stays centred on where it was.
        if ratio != nil {
            if edge.isHorizontal {
                updated = OverlayCrop(
                    x: updated.x,
                    y: crop.y + (crop.height - updated.height) / 2,
                    width: updated.width,
                    height: updated.height
                )
            } else {
                updated = OverlayCrop(
                    x: crop.x + (crop.width - updated.width) / 2,
                    y: updated.y,
                    width: updated.width,
                    height: updated.height
                )
            }
            updated = contained(updated, ratio: ratio, minimumSide: minimumSide)
        }
        return updated
    }

    /// The rectangle reshaped to a newly picked preset, keeping its centre and
    /// as much of its size as the picture allows.
    static func fitted(
        _ crop: OverlayCrop,
        to ratio: Double?,
        minimumSide: Double
    ) -> OverlayCrop {
        guard let ratio, ratio > 0 else {
            return contained(crop, ratio: nil, minimumSide: minimumSide)
        }
        let centreX = crop.x + crop.width / 2
        let centreY = crop.y + crop.height / 2
        // Whichever of the two ways of keeping a dimension fits inside the
        // picture; a preset should never have to grow the rectangle to obey.
        var width = min(crop.width, crop.height * ratio)
        var height = width / ratio
        if height > 1 {
            height = 1
            width = height * ratio
        }
        return contained(
            OverlayCrop(
                x: centreX - width / 2,
                y: centreY - height / 2,
                width: width,
                height: height
            ),
            ratio: ratio,
            minimumSide: minimumSide
        )
    }

    /// A rectangle with a new size, holding one corner still.
    private static func anchored(
        _ crop: OverlayCrop,
        width: Double,
        height: Double,
        keepingRight: Bool,
        keepingBottom: Bool,
        ratio: Double?,
        minimumSide: Double
    ) -> OverlayCrop {
        let right = crop.x + crop.width
        let bottom = crop.y + crop.height
        let sized = contained(
            OverlayCrop(
                x: keepingRight ? right - width : crop.x,
                y: keepingBottom ? bottom - height : crop.y,
                width: width,
                height: height
            ),
            ratio: ratio,
            minimumSide: minimumSide
        )
        // Clamping may have changed the size, and the anchored corner has to
        // stay put whatever that did to it.
        return contained(
            OverlayCrop(
                x: keepingRight ? right - sized.width : sized.x,
                y: keepingBottom ? bottom - sized.height : sized.y,
                width: sized.width,
                height: sized.height
            ),
            ratio: nil,
            minimumSide: minimumSide
        )
    }

    /// A rectangle inside the picture, no smaller than the minimum, and still
    /// the right shape if it is being held to one.
    static func contained(
        _ crop: OverlayCrop,
        ratio: Double?,
        minimumSide: Double
    ) -> OverlayCrop {
        let floor = min(1, max(0.01, minimumSide))
        var width = min(1, max(floor, crop.width))
        var height = min(1, max(floor, crop.height))

        if let ratio, ratio > 0 {
            height = width / ratio
            if height > 1 {
                height = 1
                width = height * ratio
            }
            if height < floor {
                height = floor
                width = height * ratio
            }
            if width > 1 {
                width = 1
                height = width / ratio
            }
            // A shape the picture simply cannot hold at this size. The picture
            // wins: a rectangle hanging outside it is not a crop.
            width = min(1, width)
            height = min(1, height)
        }

        return OverlayCrop(
            x: min(1 - width, max(0, crop.x)),
            y: min(1 - height, max(0, crop.y)),
            width: width,
            height: height
        )
    }
}
