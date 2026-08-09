import CoreGraphics
import Foundation
import Testing
@testable import YapperNative

struct WaveformBarsTests {
    private let peaks: [Float] = Array(repeating: 1, count: 400)

    @Test func barsFillTheWidthOnTheirRegularStep() {
        let rects = WaveformBars.rects(
            peaks: peaks,
            sampleRange: 0 ..< peaks.count,
            size: CGSize(width: 100, height: 40)
        )
        let step = WaveformBars.barWidth + WaveformBars.barGap
        #expect(rects.count == Int(ceil(100 / step)))
        #expect(rects.first?.minX == 0)
        #expect(rects.last!.maxX <= 100)
        for (index, rect) in rects.enumerated() {
            #expect(abs(rect.minX - CGFloat(index) * step) < 0.001)
        }
    }

    @Test func barsAreCentredAndScaleWithTheirPeak() {
        var quiet: [Float] = Array(repeating: 0, count: 200)
        quiet.append(contentsOf: Array(repeating: 1, count: 200))
        let rects = WaveformBars.rects(
            peaks: quiet,
            sampleRange: 0 ..< quiet.count,
            size: CGSize(width: 100, height: 40)
        )
        for rect in rects {
            #expect(abs(rect.midY - 20) < 0.001)
        }
        // Silence still draws a hairline, sound draws the full height.
        #expect(rects.first!.height < 2)
        #expect(rects.last!.height > 30)
    }

    @Test func nothingIsDrawnWithoutSamplesOrRoom() {
        #expect(WaveformBars.rects(peaks: [], sampleRange: 0 ..< 0, size: CGSize(width: 100, height: 40)).isEmpty)
        #expect(WaveformBars.rects(peaks: peaks, sampleRange: 0 ..< 400, size: .zero).isEmpty)
        // A range past the end of the peaks is clamped, not a crash.
        #expect(!WaveformBars.rects(
            peaks: peaks,
            sampleRange: 300 ..< 900,
            size: CGSize(width: 50, height: 40)
        ).isEmpty)
    }
}
