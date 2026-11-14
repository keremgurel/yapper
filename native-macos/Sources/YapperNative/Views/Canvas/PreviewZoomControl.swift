import SwiftUI

/// Pulls the preview back from the panel it fills, and pushes it past it.
///
/// The readout is a button rather than a label: at 60% or at 300% the thing you
/// want next is almost always 100%, and a click on the number you are already
/// reading is the shortest way to say so.
struct PreviewZoomControl: View {
    @Binding var zoom: PreviewZoom

    var body: some View {
        HStack(spacing: 2) {
            stepButton(.minus, to: zoom.stepped(by: -PreviewZoom.step))
                .disabled(zoom.isMinimum)
                .help("Smaller, for reaching handles outside the frame")

            Button {
                zoom = .fit
            } label: {
                Text("\(zoom.percent)%")
                    .font(.studioLabelStrong)
                    .monospacedDigit()
                    .frame(width: 44, height: 24)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.studioPlain)
            .disabled(zoom.isFit)
            .help("Fit the preview to the panel")

            stepButton(.plus, to: zoom.stepped(by: PreviewZoom.step))
                .disabled(zoom.isMaximum)
                .help("Larger, up to \(Int(PreviewZoom.maximumScale * 100))%, for looking at detail. Scroll to move around.")
        }
        .padding(.horizontal, 2)
        .frame(height: StudioBarButtonStyle.height)
        .background(Color.studioFaintFill, in: Capsule(style: .continuous))
    }

    private func stepButton(_ glyph: StudioGlyphKind, to next: PreviewZoom) -> some View {
        Button {
            zoom = next
        } label: {
            StudioGlyph(glyph, size: 11)
                .frame(width: 24, height: 24)
                .contentShape(Rectangle())
        }
        .buttonStyle(.studioPlain)
    }
}
