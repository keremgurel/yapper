import SwiftUI

extension View {
    /// A soft band of light sweeping across the view, for work in progress.
    /// Holds still when the system asks for reduced motion.
    func nativeShimmer(active: Bool = true) -> some View {
        modifier(NativeShimmer(active: active))
    }
}

private struct NativeShimmer: ViewModifier {
    let active: Bool
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        if active && !reduceMotion {
            content.overlay {
                TimelineView(.animation) { timeline in
                    let period = 1.6
                    let phase = timeline.date.timeIntervalSinceReferenceDate.truncatingRemainder(dividingBy: period) / period
                    GeometryReader { proxy in
                        LinearGradient(
                            colors: [.white.opacity(0), .white.opacity(0.55), .white.opacity(0)],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                        .frame(width: proxy.size.width * 0.6)
                        .offset(x: (phase * 1.6 - 0.6) * proxy.size.width)
                        .blendMode(.plusLighter)
                    }
                }
                .mask(content)
                .allowsHitTesting(false)
            }
        } else {
            content
        }
    }
}
