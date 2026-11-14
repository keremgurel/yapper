import SwiftUI

/// The few strokes Studio's glyphs are built from, on the family's 20-point
/// grid. Coordinates are grid units; the shape scales the finished path.
struct GlyphPen {
    private(set) var path = Path()

    mutating func line(_ x1: CGFloat, _ y1: CGFloat, _ x2: CGFloat, _ y2: CGFloat) {
        path.move(to: CGPoint(x: x1, y: y1))
        path.addLine(to: CGPoint(x: x2, y: y2))
    }

    /// An open run of straight segments through the given points.
    mutating func polyline(_ points: [(CGFloat, CGFloat)], closed: Bool = false) {
        guard let first = points.first else { return }
        path.move(to: CGPoint(x: first.0, y: first.1))
        for point in points.dropFirst() {
            path.addLine(to: CGPoint(x: point.0, y: point.1))
        }
        if closed { path.closeSubpath() }
    }

    mutating func arc(
        from start: (CGFloat, CGFloat),
        to end: (CGFloat, CGFloat),
        control: (CGFloat, CGFloat)
    ) {
        path.move(to: CGPoint(x: start.0, y: start.1))
        path.addQuadCurve(
            to: CGPoint(x: end.0, y: end.1),
            control: CGPoint(x: control.0, y: control.1)
        )
    }

    mutating func circle(_ x: CGFloat, _ y: CGFloat, _ radius: CGFloat) {
        path.addEllipse(in: CGRect(x: x - radius, y: y - radius, width: radius * 2, height: radius * 2))
    }

    mutating func rounded(
        _ x: CGFloat,
        _ y: CGFloat,
        _ width: CGFloat,
        _ height: CGFloat,
        _ radius: CGFloat
    ) {
        path.addRoundedRect(
            in: CGRect(x: x, y: y, width: width, height: height),
            cornerSize: CGSize(width: radius, height: radius)
        )
    }
}
