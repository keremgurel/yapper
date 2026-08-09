import Foundation

/// Where several pieces of on-screen text sit when they are up at the same time.
///
/// Holding a run of labels until the end of a list is a thing people ask for —
/// "add each percentage and hold them all until I finish" — and the moment they
/// overlap in time they have to stop overlapping in space. Placed one under the
/// next, in the order they arrive, so the column builds downwards as the speaker
/// says each one.
///
/// Pure arithmetic on fractions of the frame, so the stacking is testable
/// without a canvas.
enum TextStackLayout {
    /// One thing waiting for a row: when it comes on, and when it leaves.
    struct Span: Equatable, Sendable {
        var start: Double
        var end: Double

        init(start: Double, end: Double) {
            self.start = start
            self.end = end
        }
    }

    /// Where the first row sits. High enough to be clear of the captions, which
    /// live near the bottom, and low enough not to fight a cutaway pinned to the
    /// top of the frame.
    static let firstRow = 0.24
    /// The gap between rows, as a fraction of the frame's height. Roughly a line
    /// and a half at the default size, so a stack reads as a list.
    static let rowHeight = 0.085
    /// The lowest a row may be pushed before it would land in the captions.
    static let lastRow = 0.62

    /// A y for each span, in the order given.
    ///
    /// A row is reused the moment the text that had it has left, so a series of
    /// labels that replace each other all sit in the same place, and only text
    /// that genuinely shares the screen is moved down.
    static func rows(for spans: [Span]) -> [Double] {
        // When each row frees up. A span may take any row already free by the
        // time it arrives.
        var freeFrom: [Double] = []
        var result: [Double] = []

        for span in spans {
            let row = freeFrom.firstIndex { $0 <= span.start + 0.001 } ?? freeFrom.count
            if row < freeFrom.count {
                freeFrom[row] = span.end
            } else {
                freeFrom.append(span.end)
            }
            result.append(y(forRow: row))
        }
        return result
    }

    /// Rows past the last one stack on the last one rather than sliding off the
    /// bottom of the frame and into the captions. Seven labels at once is not a
    /// layout anyone planned, and overlapping in the middle beats disappearing.
    static func y(forRow row: Int) -> Double {
        min(lastRow, firstRow + Double(max(0, row)) * rowHeight)
    }
}
