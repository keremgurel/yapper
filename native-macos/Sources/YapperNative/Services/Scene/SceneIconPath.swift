import CoreGraphics
import Foundation

/// Turns a catalogue icon's SVG elements into one stroked `CGPath`.
///
/// Lucide draws every icon in a 24-unit square as a handful of paths,
/// circles, lines and polygons meant to be stroked, not filled. They are
/// combined here in that square and then fitted, aspect preserved and centred,
/// into whatever box the node gives them.
enum SceneIconPath {
    /// The icon in the catalogue's own square, top-left origin.
    static func unitPath(for elements: [SceneIconCatalog.Element]) -> CGPath {
        let path = CGMutablePath()
        for element in elements {
            let a = element.attributes
            switch element.tag {
            case "path":
                if let d = a["d"], let sub = ScenePathParser.path(from: d) {
                    path.addPath(sub)
                }
            case "circle":
                if let cx = value(a["cx"]), let cy = value(a["cy"]), let r = value(a["r"]) {
                    path.addEllipse(in: CGRect(x: cx - r, y: cy - r, width: r * 2, height: r * 2))
                }
            case "ellipse":
                if let cx = value(a["cx"]), let cy = value(a["cy"]),
                   let rx = value(a["rx"]), let ry = value(a["ry"])
                {
                    path.addEllipse(in: CGRect(x: cx - rx, y: cy - ry, width: rx * 2, height: ry * 2))
                }
            case "rect":
                if let w = value(a["width"]), let h = value(a["height"]) {
                    let rect = CGRect(x: value(a["x"]) ?? 0, y: value(a["y"]) ?? 0, width: w, height: h)
                    let rx = value(a["rx"]) ?? value(a["ry"]) ?? 0
                    let ry = value(a["ry"]) ?? rx
                    if rx > 0 || ry > 0 {
                        path.addRoundedRect(
                            in: rect,
                            cornerWidth: min(rx, w / 2),
                            cornerHeight: min(ry, h / 2)
                        )
                    } else {
                        path.addRect(rect)
                    }
                }
            case "line":
                if let x1 = value(a["x1"]), let y1 = value(a["y1"]),
                   let x2 = value(a["x2"]), let y2 = value(a["y2"])
                {
                    path.move(to: CGPoint(x: x1, y: y1))
                    path.addLine(to: CGPoint(x: x2, y: y2))
                }
            case "polyline", "polygon":
                let points = points(a["points"])
                guard let first = points.first else { continue }
                path.move(to: first)
                for point in points.dropFirst() { path.addLine(to: point) }
                if element.tag == "polygon" { path.closeSubpath() }
            default:
                continue
            }
        }
        return path
    }

    /// The icon fitted inside `size` points, in the layer's bottom-left
    /// coordinates, ready to be stroked.
    static func path(
        for elements: [SceneIconCatalog.Element],
        viewBox: Double,
        in size: CGSize
    ) -> CGPath {
        let unit = unitPath(for: elements)
        guard viewBox > 0, size.width > 0, size.height > 0 else { return unit }
        let side = min(size.width, size.height)
        let scale = side / CGFloat(viewBox)
        // Centred in the box, then flipped so the icon is the right way up
        // in a layer that counts from the bottom.
        var transform = SceneGeometry.flip(height: size.height)
            .translatedBy(x: (size.width - side) / 2, y: (size.height - side) / 2)
            .scaledBy(x: scale, y: scale)
        return unit.copy(using: &transform) ?? unit
    }

    private static func value(_ raw: String?) -> CGFloat? {
        guard let raw, let number = Double(raw.trimmingCharacters(in: .whitespaces)) else { return nil }
        return CGFloat(number)
    }

    private static func points(_ raw: String?) -> [CGPoint] {
        guard let raw else { return [] }
        let numbers = raw
            .split(whereSeparator: { $0 == " " || $0 == "," || $0 == "\n" })
            .compactMap { Double($0) }
        guard numbers.count >= 2 else { return [] }
        return stride(from: 0, to: numbers.count - 1, by: 2).map {
            CGPoint(x: numbers[$0], y: numbers[$0 + 1])
        }
    }
}
