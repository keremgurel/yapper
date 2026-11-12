import SwiftUI

/// Studio's own navigation glyphs, the same family the web rail draws in
/// `src/components/studio-shell/studio-nav-icon.tsx`: one 20-point grid, one
/// rounded 1.6-point stroke and soft geometric forms. Drawn in the current
/// foreground style, so a row colours its glyph and its label together.
struct StudioNavGlyph: View {
    let destination: StudioDestination
    var size: CGFloat = 18

    var body: some View {
        StudioNavGlyphShape(destination: destination)
            .stroke(style: StrokeStyle(lineWidth: 1.6 * size / 20, lineCap: .round, lineJoin: .round))
            .frame(width: size, height: size)
            .accessibilityHidden(true)
    }
}

private struct StudioNavGlyphShape: Shape {
    let destination: StudioDestination

    func path(in rect: CGRect) -> Path {
        var p = Path()
        switch destination {
        case .home:
            p.move(to: pt(3.5, 9.2))
            p.addLine(to: pt(10, 3.6))
            p.addLine(to: pt(16.5, 9.2))
            p.addLine(to: pt(16.5, 14.5))
            p.addQuadCurve(to: pt(14.5, 16.5), control: pt(16.5, 16.5))
            p.addLine(to: pt(5.5, 16.5))
            p.addQuadCurve(to: pt(3.5, 14.5), control: pt(3.5, 16.5))
            p.closeSubpath()
            line(&p, 7.6, 13.4, 12.4, 13.4)
        case .brain:
            p.move(to: pt(10, 4.4))
            p.addCurve(to: pt(4.2, 10), control1: pt(6.5, 2.6), control2: pt(3.6, 6.5))
            p.addCurve(to: pt(10, 15.6), control1: pt(3.6, 13.8), control2: pt(7, 17.2))
            p.closeSubpath()
            p.move(to: pt(10, 4.4))
            p.addCurve(to: pt(15.8, 10), control1: pt(13.5, 2.6), control2: pt(16.4, 6.5))
            p.addCurve(to: pt(10, 15.6), control1: pt(16.4, 13.8), control2: pt(13, 17.2))
            line(&p, 7.3, 9.3, 8.5, 9.3)
            line(&p, 11.5, 11.5, 12.7, 11.5)
        case .ideas:
            rounded(&p, 3.5, 3.5, 5.4, 5.4, 1.6)
            rounded(&p, 11.1, 3.5, 5.4, 5.4, 2.7)
            rounded(&p, 3.5, 11.1, 5.4, 5.4, 2.7)
            rounded(&p, 11.1, 11.1, 5.4, 5.4, 1.6)
        case .recorder:
            rounded(&p, 2.8, 5.4, 10.4, 9.2, 2.4)
            p.move(to: pt(13.2, 9))
            p.addLine(to: pt(16.6, 7))
            p.addLine(to: pt(16.6, 13))
            p.addLine(to: pt(13.2, 11))
        case .editor:
            circle(&p, 5.6, 6, 2.1)
            circle(&p, 5.6, 14, 2.1)
            line(&p, 7.4, 7.2, 16.5, 13.5)
            line(&p, 7.4, 12.8, 10.6, 10.6)
            line(&p, 13.4, 8.6, 16.5, 6.5)
        case .audio:
            circle(&p, 6.6, 14.2, 2.2)
            circle(&p, 14, 12.6, 2.2)
            p.move(to: pt(8.8, 14.2))
            p.addLine(to: pt(8.8, 5.2))
            p.addLine(to: pt(16.2, 3.8))
            p.addLine(to: pt(16.2, 12.6))
        case .poster:
            p.move(to: pt(16.6, 3.4))
            p.addLine(to: pt(12, 16.4))
            p.addLine(to: pt(9.2, 10.8))
            p.addLine(to: pt(3.6, 8))
            p.closeSubpath()
            line(&p, 16.6, 3.4, 9.2, 10.8)
        case .calendar:
            rounded(&p, 3.5, 4.6, 13, 12, 2.6)
            line(&p, 3.5, 8.6, 16.5, 8.6)
            line(&p, 7, 3, 7, 6)
            line(&p, 13, 3, 13, 6)
            circle(&p, 7.3, 12.2, 0.4)
            circle(&p, 10, 12.2, 0.4)
        case .automations:
            p.move(to: pt(10.8, 3.2))
            p.addLine(to: pt(4.8, 11.4))
            p.addLine(to: pt(9.4, 11.4))
            p.addLine(to: pt(8.9, 16.8))
            p.addLine(to: pt(15, 8.6))
            p.addLine(to: pt(10.3, 8.6))
            p.closeSubpath()
        case .brand:
            circle(&p, 7.4, 7.6, 3.6)
            circle(&p, 12.6, 7.6, 3.6)
            circle(&p, 10, 12.2, 3.6)
        case .storage:
            p.addEllipse(in: CGRect(x: 4, y: 3.2, width: 12, height: 4.8))
            p.move(to: pt(4, 5.6))
            p.addLine(to: pt(4, 14.4))
            p.addQuadCurve(to: pt(16, 14.4), control: pt(10, 19.2))
            p.addLine(to: pt(16, 5.6))
            p.move(to: pt(4, 10))
            p.addQuadCurve(to: pt(16, 10), control: pt(10, 14.8))
        case .dictionary:
            rounded(&p, 4.2, 3.4, 11.6, 13.2, 2)
            p.move(to: pt(7.6, 11.8))
            p.addLine(to: pt(10, 6.2))
            p.addLine(to: pt(12.4, 11.8))
            line(&p, 8.5, 9.9, 11.5, 9.9)
            line(&p, 7.4, 14.2, 12.6, 14.2)
        case .connections:
            circle(&p, 5.2, 10, 2.2)
            circle(&p, 14.6, 5, 2.2)
            circle(&p, 14.6, 15, 2.2)
            line(&p, 7.2, 9, 12.6, 6.1)
            line(&p, 7.2, 11, 12.6, 13.9)
        }
        let scale = min(rect.width, rect.height) / 20
        return p.applying(CGAffineTransform(scaleX: scale, y: scale))
    }

    private func pt(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
        CGPoint(x: x, y: y)
    }

    private func line(_ p: inout Path, _ x1: CGFloat, _ y1: CGFloat, _ x2: CGFloat, _ y2: CGFloat) {
        p.move(to: CGPoint(x: x1, y: y1))
        p.addLine(to: CGPoint(x: x2, y: y2))
    }

    private func circle(_ p: inout Path, _ x: CGFloat, _ y: CGFloat, _ radius: CGFloat) {
        p.addEllipse(in: CGRect(x: x - radius, y: y - radius, width: radius * 2, height: radius * 2))
    }

    private func rounded(
        _ p: inout Path,
        _ x: CGFloat,
        _ y: CGFloat,
        _ width: CGFloat,
        _ height: CGFloat,
        _ radius: CGFloat
    ) {
        p.addRoundedRect(
            in: CGRect(x: x, y: y, width: width, height: height),
            cornerSize: CGSize(width: radius, height: radius)
        )
    }
}
