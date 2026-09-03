import CoreGraphics
import Foundation
import QuartzCore

/// One node's layers, with the handles the still and the animated passes both
/// drive so neither has to know what kind of node it is looking at.
struct SceneNodeLayer {
    let node: SceneNode
    /// The box the node's fractions are measured against, in points.
    let parentSize: CGSize
    let layer: CALayer
    /// The shape whose outline `strokeEnd` runs along, when the node has one.
    /// The node's own layer for ellipses, lines, paths and icons; a child for
    /// a rectangle with a border.
    let shape: CAShapeLayer?
    /// The shape's path for a box of `size` points. Set alongside `shape`, so a
    /// node whose size animates keeps an outline that fits it.
    let path: ((CGSize) -> CGPath)?
    /// A sublayer pinned to the node's top edge, which is where text hangs
    /// from. It is repositioned when the node's height changes.
    let topAnchored: CALayer?
    /// The face of a number node.
    let counter: SceneCounterFace?
    /// Anything else that has to be re-laid for a new size: a rectangle's
    /// corner radius, an image's mask.
    let layout: ((CGSize) -> Void)?
    let children: [SceneNodeLayer]

    init(
        node: SceneNode,
        parentSize: CGSize,
        layer: CALayer,
        shape: CAShapeLayer? = nil,
        path: ((CGSize) -> CGPath)? = nil,
        topAnchored: CALayer? = nil,
        counter: SceneCounterFace? = nil,
        layout: ((CGSize) -> Void)? = nil,
        children: [SceneNodeLayer] = []
    ) {
        self.node = node
        self.parentSize = parentSize
        self.layer = layer
        self.shape = shape
        self.path = path
        self.topAnchored = topAnchored
        self.counter = counter
        self.layout = layout
        self.children = children
    }

    /// Sets the model values for one moment. The still renderer calls it with
    /// the poster time; the animated one with time zero, so the first frame
    /// and a still of the first frame agree.
    func apply(_ state: SceneNodeState) {
        let frame = state.frame(of: node, parentSize: parentSize)
        let placement = SceneGeometry.placement(of: frame, anchor: node.anchor, parentSize: parentSize)
        layer.anchorPoint = placement.anchorPoint
        layer.bounds = placement.bounds
        layer.position = placement.position
        layer.opacity = Float(state.opacity)
        layer.transform = SceneGeometry.transform(
            scaleX: state.scaleX,
            scaleY: state.scaleY,
            rotate: state.rotate
        )
        if let shape {
            shape.strokeEnd = CGFloat(state.strokeEnd)
            if let path { shape.path = path(frame.size) }
        }
        // The counter draws its face first, because the face's bleed is what
        // the top-anchored placement below has to allow for.
        counter?.show(progress: state.value)
        if let topAnchored {
            topAnchored.position = Self.topAnchoredPosition(for: frame.size, bleed: topAnchoredBleed)
        }
        layout?(frame.size)
    }

    /// The inset the typography bitmap was drawn with, kept on the layer so a
    /// later relayout can put it back exactly where it was.
    var topAnchoredBleed: CGFloat {
        (topAnchored?.value(forKey: Self.bleedKey) as? CGFloat) ?? 0
    }

    static let bleedKey = "yapper.scene.bleed"

    /// Where a top-anchored sublayer (anchor point at its top left) sits for
    /// a node `size` big: hanging from the top edge, pushed out by its bleed.
    static func topAnchoredPosition(for size: CGSize, bleed: CGFloat) -> CGPoint {
        CGPoint(x: -bleed, y: size.height + bleed)
    }
}
