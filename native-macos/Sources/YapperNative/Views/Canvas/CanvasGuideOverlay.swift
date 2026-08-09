import SwiftUI

/// Draws the alignment lines a caption has settled onto.
///
/// Lives above the card and across the whole stage, so a line reads as an
/// alignment to the frame rather than to the card it came from.
struct CanvasGuideOverlay: View {
    let guides: [CanvasGuide]
    let canvasSize: CGSize

    var body: some View {
        ZStack {
            ForEach(guides) { guide in
                line(for: guide)
            }
        }
        .allowsHitTesting(false)
    }

    @ViewBuilder
    private func line(for guide: CanvasGuide) -> some View {
        switch guide.axis {
        case .vertical:
            guideStroke(width: 1, height: canvasSize.height)
                .position(
                    x: canvasSize.width * guide.position,
                    y: canvasSize.height / 2
                )
        case .horizontal:
            guideStroke(width: canvasSize.width, height: 1)
                .position(
                    x: canvasSize.width / 2,
                    y: canvasSize.height * guide.position
                )
        }
    }

    /// A dark companion under the orange keeps the line readable over bright
    /// footage, where a hairline on its own disappears.
    private func guideStroke(width: CGFloat, height: CGFloat) -> some View {
        Rectangle()
            .fill(Color.yapperOrange)
            .frame(width: width, height: height)
            .shadow(color: .black.opacity(0.55), radius: 1)
    }
}
