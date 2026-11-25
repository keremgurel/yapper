import SwiftUI

/// What is on the edit, drawn along one strip: the kept clips with a hairline
/// at every cut, the captions as a row of marks above them, text along the
/// top edge, and any template laid over a stretch along the bottom.
struct ScrubberMarks: View {
    let duration: Double
    let clips: [Double]
    let captions: [ClosedRange<Double>]
    let texts: [ClosedRange<Double>]
    let layouts: [ClosedRange<Double>]

    /// Matches the timeline's caption cells, so a creator who opens it finds
    /// the same colour for the same thing.
    private static let captionColor = Color(red: 0.13, green: 0.29, blue: 0.42)

    var body: some View {
        Canvas { context, size in
            guard duration > 0 else { return }
            let scale = size.width / duration
            func band(_ range: ClosedRange<Double>, y: CGFloat, height: CGFloat) -> Path {
                let x = range.lowerBound * scale
                let width = max(2, (range.upperBound - range.lowerBound) * scale - 1)
                return Path(roundedRect: CGRect(x: x, y: y, width: width, height: height), cornerRadius: height / 2)
            }

            var cursor = 0.0
            for length in clips {
                let x = cursor * scale
                let width = max(1, length * scale - 1)
                let rect = CGRect(x: x, y: 9, width: width, height: size.height - 18)
                context.fill(Path(roundedRect: rect, cornerRadius: 4), with: .color(.primary.opacity(0.1)))
                cursor += length
            }
            for range in captions {
                context.fill(band(range, y: 13, height: 4), with: .color(Self.captionColor))
            }
            for range in texts {
                context.fill(band(range, y: 3, height: 4), with: .color(.primary.opacity(0.55)))
            }
            for range in layouts {
                context.fill(band(range, y: size.height - 7, height: 4), with: .color(.yapperOrange))
            }
        }
        .allowsHitTesting(false)
    }
}
