import AppKit
import Foundation
import SwiftUI
import Testing
@testable import YapperNative

/// Renders a transcript-sized run of words the way the panel now does: wrapping
/// worked out from measured text, then lazy rows.
///
/// For the record, the custom `Layout` this replaced measured every word twice
/// per pass and could not be lazy, so its cost grew with the transcript:
///
///     200 words   50.1 ms      1000 words   54.4 ms      2000 words  116.2 ms
///
/// The numbers below should stay flat instead, because the count of words off
/// screen stops mattering.
@MainActor
struct TranscriptFlowLayoutBenchmark {
    @Test(
        "Transcript render cost",
        .enabled(if: ProcessInfo.processInfo.environment["YAPPER_BENCH"] == "1")
    )
    func renderCost() {
        for count in [200, 1_000, 2_000] {
            let words = (0 ..< count).map { "word\($0)" }
            let wrap = measure { _ = lines(for: words, width: 520) }
            let render = renderRows(words: words, width: 520, height: 400)
            print(String(
                format: "%5d words · wrapping %.2f ms · render %.1f ms",
                count,
                wrap * 1000,
                render * 1000
            ))
        }
        #expect(true)
    }

    private func lines(for words: [String], width: Double) -> [TranscriptLine] {
        let widths = TranscriptTokenWidths.widths(
            of: words,
            font: .systemFont(ofSize: 14, weight: .bold),
            padding: 6
        )
        return TranscriptLineBreaker.lines(widths: widths, spacing: 6, available: width)
    }

    private func renderRows(words: [String], width: CGFloat, height: CGFloat) -> Double {
        let widths = TranscriptTokenWidths.widths(
            of: words,
            font: .systemFont(ofSize: 14, weight: .bold),
            padding: 6
        )
        let rows = TranscriptLineBreaker.lines(widths: widths, spacing: 6, available: width)
        let view = ScrollView {
            LazyVStack(alignment: .leading, spacing: 6) {
                ForEach(rows) { line in
                    HStack(spacing: 6) {
                        ForEach(line.tokens, id: \.self) { token in
                            Text(words[token])
                                .font(.system(size: 14))
                                .padding(.horizontal, 3)
                                .frame(width: widths[token], alignment: .leading)
                        }
                    }
                    .frame(height: 26, alignment: .leading)
                }
            }
        }
        .frame(width: width, height: height)

        return measure { _ = ImageRenderer(content: view).nsImage }
    }

    private func measure(_ work: () -> Void) -> Double {
        let start = ContinuousClock.now
        work()
        return Double(ContinuousClock.now.duration(to: start).components.attoseconds) / -1e18
    }
}
