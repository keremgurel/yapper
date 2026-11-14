import SwiftUI

/// A file's loudness along the bottom of its trim strip, so a pause or the
/// start of a sentence can be found without playing it.
struct MediaTrimWaveform: View {
    let peaks: [Float]

    var body: some View {
        Canvas { context, size in
            guard !peaks.isEmpty, size.width > 0 else { return }
            let barWidth = 2.0
            let gap = 1.0
            let bars = max(1, Int(size.width / (barWidth + gap)))
            let perBar = Double(peaks.count) / Double(bars)
            var path = Path()
            for bar in 0 ..< bars {
                let from = Int(Double(bar) * perBar)
                let to = min(peaks.count, max(from + 1, Int(Double(bar + 1) * perBar)))
                guard from < to else { continue }
                // The loudest sample in the slice: an average flattens speech
                // into a band and hides the gaps between words.
                let peak = Double(peaks[from ..< to].max() ?? 0)
                let height = max(1, min(1, peak) * size.height)
                path.addRect(CGRect(
                    x: Double(bar) * (barWidth + gap),
                    y: size.height - height,
                    width: barWidth,
                    height: height
                ))
            }
            context.fill(path, with: .color(.white.opacity(0.85)))
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}
