import CoreGraphics
import Foundation

/// Where the bars of a waveform sit inside a cell.
///
/// Pulled out of the drawing so the shape can build one path and fill it once.
/// It used to allocate a path per bar and fill each on its own, which is a
/// thousand fills across a full timeline for every frame of a resize.
enum WaveformBars {
    static let barWidth: CGFloat = 1.5
    static let barGap: CGFloat = 1
    static let cornerRadius: CGFloat = 0.75
    private static let minimumHeight: CGFloat = 1.5
    /// Quiet passages are lifted a little so speech reads as speech rather than
    /// a flat line with occasional spikes.
    private static let emphasis: CGFloat = 0.72

    /// - Parameter gain: how loud this is being played, so the drawing says
    ///   what the mix will do. A fader pulled down that left the waveform at
    ///   full height would be the timeline disagreeing with the export.
    static func rects(
        peaks: [Float],
        sampleRange: Range<Int>,
        size: CGSize,
        gain: Double = 1
    ) -> [CGRect] {
        let lowerBound = max(0, min(peaks.count, sampleRange.lowerBound))
        let upperBound = max(lowerBound, min(peaks.count, sampleRange.upperBound))
        guard upperBound > lowerBound, size.width > 0, size.height > 0 else { return [] }

        let step = barWidth + barGap
        let columns = max(1, Int(ceil(size.width / step)))
        let middle = size.height / 2
        var rects: [CGRect] = []
        rects.reserveCapacity(columns)

        for column in 0 ..< columns {
            let x = CGFloat(column) * step
            guard x < size.width else { break }
            let samples = TimelineWaveformGeometry.sampleRange(
                column: column,
                columnCount: columns,
                samples: lowerBound ..< upperBound
            )
            guard !samples.isEmpty else { continue }
            let peak = peaks[samples].max() ?? 0
            // The gain goes on the sample, before the curve, because that is
            // where a fader acts: on the sound, not on the picture of it.
            let level = CGFloat(max(0, peak)) * CGFloat(max(0, gain))
            // Silence still draws its line. A cell that went blank would read
            // as a clip with no audio at all rather than one turned down.
            let drawn = level > 0 ? pow(level, emphasis) * (size.height - 2) : 0
            let height = max(minimumHeight, drawn)
            rects.append(
                CGRect(
                    x: x,
                    y: middle - height / 2,
                    width: min(barWidth, size.width - x),
                    height: height
                )
            )
        }
        return rects
    }
}
