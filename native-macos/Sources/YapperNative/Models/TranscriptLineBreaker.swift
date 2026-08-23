import CoreGraphics
import Foundation

/// One rendered line of the transcript: which tokens sit on it, and where.
struct TranscriptLine: Identifiable, Equatable, Sendable {
    let id: Int
    /// Indices into the token list, in reading order.
    let tokens: [Int]
    /// Each token's x offset from the left edge of the line.
    let offsets: [Double]
    let width: Double
}

/// Works out where the transcript wraps, without building a single view.
///
/// SwiftUI's `Layout` cannot be lazy: it has to measure and place every subview
/// on every pass, so a ten minute transcript was two thousand views whether or
/// not any of them were on screen, and that costs about a tenth of a second to
/// build however tight the layout arithmetic is.
///
/// Wrapping is just arithmetic over token widths, so it is done here instead.
/// Once the lines are known the transcript is a list of rows, and a list can be
/// lazy: only the rows on screen are ever built.
enum TranscriptLineBreaker {
    static func lines(widths: [Double], spacing: Double, available: Double) -> [TranscriptLine] {
        guard !widths.isEmpty else { return [] }
        let limit = max(1, available)
        var lines: [TranscriptLine] = []
        var tokens: [Int] = []
        var offsets: [Double] = []
        var x = 0.0

        func closeLine() {
            guard !tokens.isEmpty else { return }
            lines.append(
                TranscriptLine(
                    id: lines.count,
                    tokens: tokens,
                    offsets: offsets,
                    width: max(0, x - spacing)
                )
            )
            tokens = []
            offsets = []
            x = 0
        }

        for (index, width) in widths.enumerated() {
            // A token wider than the line still gets a line of its own rather
            // than being dropped or wrapped mid-word.
            if !tokens.isEmpty, x + width > limit {
                closeLine()
            }
            tokens.append(index)
            offsets.append(x)
            x += width + spacing
        }
        closeLine()
        return lines
    }

    /// Where a token sits in the whole flow, for anything that works in flow
    /// coordinates rather than in rows. Rows are a uniform height because every
    /// token is set in the same font.
    static func frame(
        ofToken token: Int,
        in lines: [TranscriptLine],
        widths: [Double],
        lineHeight: Double,
        lineSpacing: Double
    ) -> CGRect? {
        for line in lines {
            guard let position = line.tokens.firstIndex(of: token) else { continue }
            return CGRect(
                x: line.offsets[position],
                y: Double(line.id) * (lineHeight + lineSpacing),
                width: widths[token],
                height: lineHeight
            )
        }
        return nil
    }

    /// The token actually under a pointer in one rendered line.
    ///
    /// Transcript rows use one spatial gesture for the whole line. Keeping
    /// hit-testing in the same arithmetic as wrapping means each word remains
    /// individually clickable without turning every word into a SwiftUI
    /// button, focus responder, accessibility action and gesture recognizer.
    static func token(atX x: Double, in line: TranscriptLine, widths: [Double]) -> Int? {
        guard x >= 0 else { return nil }
        for (position, token) in line.tokens.enumerated() {
            guard position < line.offsets.count, token < widths.count else { continue }
            let start = line.offsets[position]
            if x >= start, x <= start + widths[token] { return token }
        }
        return nil
    }
}
