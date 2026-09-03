import CoreGraphics
import Foundation
import QuartzCore

/// The one place scene fractions become Core Animation points.
///
/// A scene measures from the top left of its box in fractions of that box.
/// Core Animation measures from the bottom left in points. Every frame, path
/// and angle in the renderer goes through here on its way in, so the flip is
/// written once and read once. The same flip `CompositionBuilder` does for an
/// image overlay's box, for the same reason.
enum SceneGeometry {
    /// Font sizes, stroke widths and corner radii are fractions of the scene
    /// box's height, whatever box the node sits in, so a scene keeps its
    /// weight when the same design lands in a wider or narrower card.
    static func length(_ fraction: Double, sceneSize: CGSize) -> CGFloat {
        CGFloat(fraction) * sceneSize.height
    }

    /// A node's box in points, measured from the top left of the box that
    /// contains it: the scene for a top level node, the group for a child.
    static func topLeftFrame(
        x: Double,
        y: Double,
        width: Double,
        height: Double,
        parentSize: CGSize
    ) -> CGRect {
        CGRect(
            x: CGFloat(x) * parentSize.width,
            y: CGFloat(y) * parentSize.height,
            width: max(0, CGFloat(width) * parentSize.width),
            height: max(0, CGFloat(height) * parentSize.height)
        )
    }

    /// Where a layer goes, in Core Animation's terms.
    ///
    /// The anchor is the point scale and rotation pivot on, so it doubles as
    /// the layer's position: a box that grows from its left edge keeps that
    /// edge still because the edge is where the layer is pinned.
    struct Placement: Equatable {
        var anchorPoint: CGPoint
        var position: CGPoint
        var bounds: CGRect
    }

    /// The placement of a top-left `frame` inside a parent `parentSize` tall.
    /// The anchor's y is flipped along with the point, because a scene anchor
    /// of `top` has to be the top of the layer, not the bottom.
    static func placement(
        of frame: CGRect,
        anchor: SceneNode.Anchor,
        parentSize: CGSize
    ) -> Placement {
        let unit = anchor.unitPoint
        let anchorPoint = CGPoint(x: unit.x, y: 1 - unit.y)
        let anchorInParent = CGPoint(
            x: frame.minX + frame.width * CGFloat(unit.x),
            y: frame.minY + frame.height * CGFloat(unit.y)
        )
        return Placement(
            anchorPoint: anchorPoint,
            position: flipped(anchorInParent, inHeight: parentSize.height),
            bounds: CGRect(origin: .zero, size: frame.size)
        )
    }

    /// A top-left point turned into a bottom-left one inside a box `height`
    /// tall.
    static func flipped(_ point: CGPoint, inHeight height: CGFloat) -> CGPoint {
        CGPoint(x: point.x, y: height - point.y)
    }

    /// The transform that carries a drawing made from the top left into a
    /// layer `height` tall. Paths are built in top-left coordinates like the
    /// SVG data they come from and pushed through this once.
    static func flip(height: CGFloat) -> CGAffineTransform {
        CGAffineTransform(a: 1, b: 0, c: 0, d: -1, tx: 0, ty: height)
    }

    /// Scale and rotation about the layer's anchor.
    ///
    /// `rotate` is degrees clockwise on a screen whose y grows downward. Core
    /// Animation's y grows upward, so the same visual turn is the negative
    /// angle, exactly as `CompositionBuilder` negates an overlay's rotation.
    static func transform(scaleX: Double, scaleY: Double, rotate: Double) -> CATransform3D {
        let scaled = CATransform3DMakeScale(CGFloat(scaleX), CGFloat(scaleY), 1)
        guard rotate != 0 else { return scaled }
        return CATransform3DConcat(scaled, CATransform3DMakeRotation(CGFloat(-rotate * .pi / 180), 0, 0, 1))
    }

    /// A corner radius that can never exceed what the box can round. Core
    /// Animation draws a radius past half the short side as a smeared corner.
    static func cornerRadius(_ fraction: Double, sceneSize: CGSize, in size: CGSize) -> CGFloat {
        min(length(fraction, sceneSize: sceneSize), min(size.width, size.height) / 2)
    }
}
