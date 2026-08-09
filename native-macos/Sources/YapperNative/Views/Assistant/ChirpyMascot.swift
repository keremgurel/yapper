import SwiftUI

/// Chirpy — Yapper's mascot. "Yapper" is a bird that will not stop chirping, so
/// the beak is the hero.
///
/// Drawn from the same coordinates as the web mascot, in the same 200×200 box,
/// so the two apps show one bird rather than two cousins. Its personality lives
/// in a few swappable parts, which is what lets one drawing cover an idle
/// corner, a working spinner and a finished job.
struct ChirpyMascot: View {
    enum Expression {
        case idle
        case yap
        case happy
        case wink
        case curious
        case oops
    }

    var expression: Expression = .idle
    /// Bobs, and works the beak. Used while the model is thinking.
    var talking = false
    var size: CGFloat = 44

    /// The drawing is laid out in the web mascot's viewBox and scaled once, so
    /// every coordinate below can be read straight off the original.
    private static let canvas: CGFloat = 200
    /// The bird only occupies part of that box — the viewBox leaves room for a
    /// ground shadow and for tufts that stick out. Scaling to the bird itself
    /// rather than to the box is what stops it swimming in its own bubble.
    private static let content: CGFloat = 162
    /// The middle of the bird, which is not the middle of the box.
    private static let centre = CGPoint(x: 106, y: 102)

    @State private var bob = false

    var body: some View {
        ZStack {
            body(of: expression)
        }
        .frame(width: Self.canvas, height: Self.canvas)
        .offset(
            x: Self.canvas / 2 - Self.centre.x,
            y: Self.canvas / 2 - Self.centre.y
        )
        .scaleEffect(size / Self.content)
        .frame(width: size, height: size)
        .offset(y: talking && bob ? -3 : 0)
        .animation(
            talking
                ? .easeInOut(duration: 1.3).repeatForever(autoreverses: true)
                : .default,
            value: bob
        )
        .onAppear { bob = true }
        .accessibilityLabel("Chirpy, the Yapper assistant")
    }

    @ViewBuilder
    private func body(of expression: Expression) -> some View {
        let parts = Parts(expression)

        ZStack {
            // Tail feathers, behind the body.
            triangle([(150, 96), (184, 84), (170, 108)]).fill(plumage)
            triangle([(152, 112), (186, 112), (166, 128)]).fill(plumage).opacity(0.9)

            // Head tufts.
            quad(from: (84, 52), control: (90, 26), to: (100, 46))
                .stroke(plumage, style: StrokeStyle(lineWidth: 12, lineCap: .round))
            quad(from: (104, 48), control: (112, 24), to: (122, 46))
                .stroke(plumage, style: StrokeStyle(lineWidth: 12, lineCap: .round))

            ellipse(cx: 98, cy: 112, rx: 68, ry: 64).fill(plumage)
            ellipse(cx: 96, cy: 138, rx: 40, ry: 32)
                .fill(Color(red: 1, green: 0.953, blue: 0.878))
                .opacity(0.85)

            eyes(parts)
            brows(parts)
            beak(parts)
        }
    }

    // MARK: - Face

    @ViewBuilder
    private func eyes(_ parts: Parts) -> some View {
        switch parts.eyes {
        case .happy:
            quad(from: (70, 100), control: (81, 87), to: (92, 100))
                .stroke(ink, style: StrokeStyle(lineWidth: 6.5, lineCap: .round))
            quad(from: (108, 100), control: (119, 87), to: (130, 100))
                .stroke(ink, style: StrokeStyle(lineWidth: 6.5, lineCap: .round))
        case .dots, .wink:
            ellipse(cx: 82, cy: 94, rx: 21, ry: 21).fill(.white)
            ellipse(cx: 120, cy: 94, rx: 21, ry: 21).fill(.white)
            if parts.eyes == .wink {
                quad(from: (72, 94), control: (82, 86), to: (92, 94))
                    .stroke(ink, style: StrokeStyle(lineWidth: 6.5, lineCap: .round))
            } else {
                ellipse(cx: 88, cy: 96, rx: 8.5, ry: 8.5).fill(ink)
            }
            ellipse(cx: 114, cy: 96, rx: 8.5, ry: 8.5).fill(ink)
        }
    }

    private func brows(_ parts: Parts) -> some View {
        ZStack {
            line(parts.brows.0).stroke(ink, style: StrokeStyle(lineWidth: 7, lineCap: .round))
            line(parts.brows.1).stroke(ink, style: StrokeStyle(lineWidth: 7, lineCap: .round))
        }
    }

    @ViewBuilder
    private func beak(_ parts: Parts) -> some View {
        if parts.beakOpen {
            triangle([(86, 118), (114, 118), (100, 130)]).fill(beakColor)
            // The lower half snaps open and shut while Chirpy is talking.
            triangle([(89, 134), (111, 134), (100, 146)])
                .fill(beakShadow)
                .scaleEffect(y: talking && bob ? 1.15 : 0.7, anchor: .top)
        } else {
            triangle([(90, 120), (110, 120), (100, 133)]).fill(beakColor)
        }
    }

    // MARK: - Ink

    private var plumage: LinearGradient {
        LinearGradient(
            stops: [
                .init(color: Color(red: 1, green: 0.416, blue: 0.102), location: 0),
                .init(color: Color(red: 0.984, green: 0.545, blue: 0.180), location: 0.55),
                .init(color: Color(red: 0.976, green: 0.659, blue: 0.145), location: 1),
            ],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

    private var beakColor: Color { Color(red: 0.969, green: 0.702, blue: 0.169) }
    private var beakShadow: Color { Color(red: 0.878, green: 0.565, blue: 0.102) }
    private var ink: Color { Color(red: 0.165, green: 0.102, blue: 0.055) }

    // MARK: - Which parts

    private struct Parts {
        enum Eyes { case dots, happy, wink }

        /// A pair of brow strokes, each an x1/y1/x2/y2 line.
        typealias Brows = (
            (CGFloat, CGFloat, CGFloat, CGFloat),
            (CGFloat, CGFloat, CGFloat, CGFloat)
        )

        let brows: Brows
        let eyes: Eyes
        let beakOpen: Bool

        init(_ expression: Expression) {
            let determined: Brows = ((64, 74, 96, 86), (138, 74, 106, 86))
            let raised: Brows = ((66, 76, 96, 70), (136, 76, 106, 70))
            let worried: Brows = ((66, 84, 96, 74), (136, 84, 104, 74))
            let curious: Brows = ((66, 76, 96, 70), (138, 74, 106, 86))

            switch expression {
            case .idle: (brows, eyes, beakOpen) = (determined, .dots, false)
            case .yap: (brows, eyes, beakOpen) = (determined, .dots, true)
            case .happy: (brows, eyes, beakOpen) = (raised, .happy, true)
            case .wink: (brows, eyes, beakOpen) = (determined, .wink, false)
            case .curious: (brows, eyes, beakOpen) = (curious, .dots, false)
            case .oops: (brows, eyes, beakOpen) = (worried, .dots, false)
            }
        }
    }

    // MARK: - Drawing helpers
    //
    // Small wrappers so the shapes above read like the original SVG.

    private func triangle(_ points: [(CGFloat, CGFloat)]) -> Path {
        var path = Path()
        guard let first = points.first else { return path }
        path.move(to: CGPoint(x: first.0, y: first.1))
        for point in points.dropFirst() {
            path.addLine(to: CGPoint(x: point.0, y: point.1))
        }
        path.closeSubpath()
        return path
    }

    private func ellipse(cx: CGFloat, cy: CGFloat, rx: CGFloat, ry: CGFloat) -> Path {
        Path(ellipseIn: CGRect(x: cx - rx, y: cy - ry, width: rx * 2, height: ry * 2))
    }

    private func line(_ points: (CGFloat, CGFloat, CGFloat, CGFloat)) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: points.0, y: points.1))
        path.addLine(to: CGPoint(x: points.2, y: points.3))
        return path
    }

    private func quad(
        from start: (CGFloat, CGFloat),
        control: (CGFloat, CGFloat),
        to end: (CGFloat, CGFloat)
    ) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: start.0, y: start.1))
        path.addQuadCurve(
            to: CGPoint(x: end.0, y: end.1),
            control: CGPoint(x: control.0, y: control.1)
        )
        return path
    }
}
