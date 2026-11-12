import SwiftUI

/// The take as one line, with the parts the edit kept filled in and the rest
/// left dim: what 1-Click Edit did, at a glance.
struct TakeCutStrip: View {
    let summary: TakeCutSummary

    var body: some View {
        Canvas { context, size in
            let track = Path(roundedRect: CGRect(origin: .zero, size: size), cornerRadius: 3)
            context.fill(track, with: .color(.white.opacity(0.14)))
            context.clip(to: track)
            for stretch in summary.stretches {
                let x = stretch.start * size.width
                // Held to a point wide, so a kept half-second in a ten-minute
                // take still shows.
                let width = max(1, (stretch.end - stretch.start) * size.width)
                context.fill(
                    Path(CGRect(x: x, y: 0, width: width, height: size.height)),
                    with: .color(.white.opacity(0.92))
                )
            }
        }
        .frame(height: 14)
        .accessibilityElement()
        .accessibilityLabel("Kept \(formatTime(summary.keptDuration)) of \(formatTime(summary.sourceDuration))")
    }
}
