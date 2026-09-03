import AppKit
import Foundation
import QuartzCore

/// Text and number nodes: a container the size of the node's box with the
/// rasterised words hanging from its top edge.
///
/// The box's height is a minimum, not a clip. The validator sets one line's
/// worth when the designer gave none, and a paragraph that wraps to two lines
/// simply reaches lower, the way it would in the design tool the model was
/// imitating. It is capped at the height of the scene, which is as far as
/// anything can be seen anyway.
enum SceneTypographyLayer {
    static func make(
        node: SceneNode,
        frame: CGRect,
        context: SceneRenderContext
    ) -> SceneNodeLayer? {
        guard let color = context.color(node.color ?? .token(.ink)) else { return nil }
        let fontSize = context.length(node.size ?? 0.12)
        let style = SceneTextRasterizer.Style(
            font: SceneFontResolver.font(node.font ?? .modern, weight: node.weight ?? .bold, size: fontSize),
            color: color,
            align: node.align ?? .left,
            lineHeight: fontSize * CGFloat(node.lineHeight ?? 1.15)
        )
        let maximumHeight = max(frame.height, context.sceneSize.height)
        let container = CALayer()

        if node.kind == .number {
            let face = SceneCounterFace(
                node: node,
                style: style,
                width: max(1, frame.width),
                maximumHeight: maximumHeight
            )
            container.addSublayer(face.layer)
            return SceneNodeLayer(
                node: node,
                parentSize: .zero,
                layer: container,
                topAnchored: face.layer,
                counter: face
            )
        }

        var text = node.text ?? ""
        if node.uppercase == true { text = text.uppercased() }
        guard let rendering = SceneTextRasterizer.render(
            text,
            style: style,
            width: max(1, frame.width),
            maximumHeight: maximumHeight
        ) else { return nil }
        let words = CALayer()
        words.contents = rendering.image
        words.contentsScale = SceneTextRasterizer.scale
        words.anchorPoint = CGPoint(x: 0, y: 1)
        words.bounds = CGRect(origin: .zero, size: rendering.size)
        words.setValue(rendering.bleed, forKey: SceneNodeLayer.bleedKey)
        container.addSublayer(words)
        return SceneNodeLayer(
            node: node,
            parentSize: .zero,
            layer: container,
            topAnchored: words
        )
    }
}
