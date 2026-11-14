import SwiftUI

/// The mark for a post that went out: a green check that draws itself onto
/// a circle the first time it appears. With Reduce Motion on, or for a
/// result that was already there, the finished mark is simply shown.
struct PosterDrawnCheck: View {
    var size: CGFloat = 14
    /// False shows the finished mark at once.
    var animated = true
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var drawn = false

    var body: some View {
        let moves = animated && !reduceMotion
        let shown = drawn || !moves
        ZStack {
            Circle().fill(Color.studioSuccess.opacity(0.16))
                .scaleEffect(shown ? 1 : 0.95)
                .opacity(shown ? 1 : 0)
                .animation(moves ? .easeOut(duration: 0.2) : nil, value: drawn)
            PosterCheckStroke()
                .trim(from: 0, to: shown ? 1 : 0)
                .stroke(Color.studioSuccess, style: StrokeStyle(lineWidth: max(1.5, size * 0.11), lineCap: .round, lineJoin: .round))
                .animation(moves ? .easeOut(duration: 0.3).delay(0.1) : nil, value: drawn)
        }
        .frame(width: size, height: size)
        .onAppear { drawn = true }
        .accessibilityHidden(true)
    }
}

/// The tick, drawn from its short arm to its long one.
private struct PosterCheckStroke: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.minX + rect.width * 0.29, y: rect.minY + rect.height * 0.52))
        path.addLine(to: CGPoint(x: rect.minX + rect.width * 0.44, y: rect.minY + rect.height * 0.67))
        path.addLine(to: CGPoint(x: rect.minX + rect.width * 0.72, y: rect.minY + rect.height * 0.36))
        return path
    }
}
