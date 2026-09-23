import SwiftUI

/// The live take as a row of level bars. Quiet columns sit as dots, so the
/// row reads as a trail while nothing is said.
struct DictationWaveform: View {
    let levels: [Double]

    var body: some View {
        Canvas { context, size in
            guard !levels.isEmpty else { return }
            let step = size.width / CGFloat(levels.count)
            let barWidth = max(2, step * 0.5)
            for (index, level) in levels.enumerated() {
                let height = max(barWidth, CGFloat(level) * size.height)
                let rect = CGRect(
                    x: CGFloat(index) * step + (step - barWidth) / 2,
                    y: (size.height - height) / 2,
                    width: barWidth,
                    height: height
                )
                context.fill(Path(roundedRect: rect, cornerRadius: barWidth / 2), with: .color(.primary.opacity(0.8)))
            }
        }
        .frame(height: 28)
        .accessibilityLabel("Recording level")
    }
}

extension Int {
    /// "0:07", "1:12".
    var dictationClock: String { "\(self / 60):\(String(format: "%02d", self % 60))" }
}
