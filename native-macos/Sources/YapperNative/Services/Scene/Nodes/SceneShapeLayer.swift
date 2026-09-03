import CoreGraphics
import Foundation
import QuartzCore

/// The nodes that are one stroked or filled path: ellipses, lines, SVG paths
/// and icons. Each is a `CAShapeLayer` whose path is a function of its size,
/// so the still pass and the size keyframes both ask the same function.
enum SceneShapeLayer {
    static func make(node: SceneNode, context: SceneRenderContext) -> SceneNodeLayer? {
        let shape = CAShapeLayer()
        shape.contentsScale = 2
        shape.lineCap = .round
        shape.lineJoin = .round
        let path: (CGSize) -> CGPath

        switch node.kind {
        case .ellipse:
            let lineWidth = node.stroke == nil ? 0 : context.strokeWidth(of: node)
            shape.fillColor = context.color(node.fill)
            shape.strokeColor = context.color(node.stroke)
            shape.lineWidth = lineWidth
            path = { size in
                let inset = min(lineWidth / 2, min(size.width, size.height) / 2)
                return CGPath(ellipseIn: CGRect(origin: .zero, size: size).insetBy(dx: inset, dy: inset), transform: nil)
            }

        case .line:
            let lineWidth = context.strokeWidth(of: node)
            shape.fillColor = nil
            shape.strokeColor = context.color(node.stroke ?? .token(.ink))
            shape.lineWidth = lineWidth
            if node.dashed == true {
                shape.lineDashPattern = [NSNumber(value: lineWidth * 3), NSNumber(value: lineWidth * 2)]
            }
            let startsLeft = node.x <= (node.x2 ?? node.x)
            let startsTop = node.y <= (node.y2 ?? node.y)
            path = { size in
                // The box is the rectangle the two ends span; which corners
                // they are depends on which way the line was written.
                let start = CGPoint(x: startsLeft ? 0 : size.width, y: startsTop ? 0 : size.height)
                let end = CGPoint(x: startsLeft ? size.width : 0, y: startsTop ? size.height : 0)
                let line = CGMutablePath()
                line.move(to: start)
                line.addLine(to: end)
                var flip = SceneGeometry.flip(height: size.height)
                return line.copy(using: &flip) ?? line
            }

        case .path:
            guard let d = node.d, let unit = ScenePathParser.path(from: d) else { return nil }
            shape.fillColor = context.color(node.fill)
            shape.strokeColor = context.color(node.stroke)
            shape.lineWidth = node.stroke == nil ? 0 : context.strokeWidth(of: node)
            path = { size in
                // Unit square onto the box, then the flip: the data was
                // written with y growing down, the layer grows up.
                var transform = SceneGeometry.flip(height: size.height)
                    .scaledBy(x: size.width, y: size.height)
                return unit.copy(using: &transform) ?? unit
            }

        case .icon:
            guard let name = node.icon, let elements = context.icons.elements(named: name) else { return nil }
            shape.fillColor = nil
            shape.strokeColor = context.color(node.color ?? .token(.ink))
            shape.lineWidth = context.length(node.strokeWidth ?? 0.02)
            let viewBox = context.icons.viewBox
            path = { size in
                SceneIconPath.path(for: elements, viewBox: viewBox, in: size)
            }

        default:
            return nil
        }

        return SceneNodeLayer(node: node, parentSize: .zero, layer: shape, shape: shape, path: path)
    }
}
