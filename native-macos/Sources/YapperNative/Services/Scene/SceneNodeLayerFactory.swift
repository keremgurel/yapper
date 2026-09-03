import Foundation
import QuartzCore

/// Builds the layer for one node at one moment, children included.
///
/// Hands each kind to its own builder, then gives the result the node's state
/// at `time` as model values. In the animated tree that time is zero and the
/// baker adds the movement afterwards; in a still it is the poster time and
/// nothing else happens.
enum SceneNodeLayerFactory {
    static func make(
        node: SceneNode,
        parentSize: CGSize,
        context: SceneRenderContext,
        time: Double
    ) -> SceneNodeLayer? {
        let state = SceneNodeState.resolve(node: node, timeline: context.timeline, at: time)
        let frame = state.frame(of: node, parentSize: parentSize)

        let built: SceneNodeLayer?
        switch node.kind {
        case .text, .number:
            built = SceneTypographyLayer.make(node: node, frame: frame, context: context)
        case .rect:
            built = SceneRectLayer.make(node: node, context: context)
        case .ellipse, .line, .path, .icon:
            built = SceneShapeLayer.make(node: node, context: context)
        case .image:
            built = SceneImageLayer.make(node: node, context: context)
        case .group:
            built = group(node: node, frame: frame, context: context, time: time)
        }
        guard let built else { return nil }

        let placed = SceneNodeLayer(
            node: node,
            parentSize: parentSize,
            layer: built.layer,
            shape: built.shape,
            path: built.path,
            topAnchored: built.topAnchored,
            counter: built.counter,
            layout: built.layout,
            children: built.children
        )
        placed.apply(state)
        return placed
    }

    /// A container whose children measure their fractions against its box.
    /// A group with nothing drawable in it is left out, like an empty node.
    private static func group(
        node: SceneNode,
        frame: CGRect,
        context: SceneRenderContext,
        time: Double
    ) -> SceneNodeLayer? {
        let container = CALayer()
        let children = (node.children ?? []).compactMap { child in
            make(node: child, parentSize: frame.size, context: context, time: time)
        }
        guard !children.isEmpty else { return nil }
        for child in children { container.addSublayer(child.layer) }
        return SceneNodeLayer(node: node, parentSize: .zero, layer: container, children: children)
    }
}
