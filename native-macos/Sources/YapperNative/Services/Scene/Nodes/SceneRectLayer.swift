import Foundation
import QuartzCore

/// A rectangle: a filled layer with rounded corners, and a shape layer on top
/// of it for the border when there is one, so `strokeEnd` can draw the border
/// on while the fill stays put.
enum SceneRectLayer {
    static func make(node: SceneNode, context: SceneRenderContext) -> SceneNodeLayer {
        let layer = CALayer()
        layer.backgroundColor = context.color(node.fill)
        let radius = node.cornerRadius ?? 0

        var border: CAShapeLayer?
        var borderPath: ((CGSize) -> CGPath)?
        if let stroke = context.color(node.stroke) {
            let lineWidth = context.strokeWidth(of: node)
            let shape = CAShapeLayer()
            shape.fillColor = nil
            shape.strokeColor = stroke
            shape.lineWidth = lineWidth
            shape.contentsScale = 2
            shape.anchorPoint = .zero
            shape.position = .zero
            border = shape
            borderPath = { size in
                // Inset by half the line so the border sits inside the fill's
                // edge instead of straddling it.
                let inset = min(lineWidth / 2, min(size.width, size.height) / 2)
                let rect = CGRect(origin: .zero, size: size).insetBy(dx: inset, dy: inset)
                let corner = max(0, SceneGeometry.cornerRadius(radius, sceneSize: context.sceneSize, in: size) - inset)
                return CGPath(
                    roundedRect: rect,
                    cornerWidth: min(corner, rect.width / 2),
                    cornerHeight: min(corner, rect.height / 2),
                    transform: nil
                )
            }
            layer.addSublayer(shape)
        }

        return SceneNodeLayer(
            node: node,
            parentSize: .zero,
            layer: layer,
            shape: border,
            path: borderPath,
            layout: { size in
                layer.cornerRadius = SceneGeometry.cornerRadius(radius, sceneSize: context.sceneSize, in: size)
                border?.bounds = CGRect(origin: .zero, size: size)
            }
        )
    }
}
