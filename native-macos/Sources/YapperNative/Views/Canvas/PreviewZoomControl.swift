import SwiftUI

/// Pulls the preview back from the panel it fills, and puts it back.
///
/// The readout is a button rather than a label: at 60% the thing you want next
/// is almost always 100%, and a click on the number you are already reading is
/// the shortest way to say so.
struct PreviewZoomControl: View {
    @Binding var zoom: PreviewZoom

    var body: some View {
        HStack(spacing: 2) {
            stepButton("minus", to: zoom.stepped(by: -PreviewZoom.step))
                .disabled(zoom.isMinimum)
                .help("Pull the preview back, for reaching handles outside the frame")

            Button {
                zoom = .fit
            } label: {
                Text("\(zoom.percent)%")
                    .font(.system(size: 11, weight: .semibold))
                    .monospacedDigit()
                    .frame(width: 40, height: 24)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.studioPlain)
            .disabled(zoom.isFit)
            .help("Fit the preview to the panel")

            stepButton("plus", to: zoom.stepped(by: PreviewZoom.step))
                .disabled(zoom.isFit)
                .help("Bring the preview back towards the panel")
        }
        .padding(.horizontal, 2)
        .frame(height: 28)
        .background(Color.studioFaintFill)
        .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 6, style: .continuous)
                .stroke(Color.studioLine, lineWidth: 1)
        }
    }

    private func stepButton(_ symbol: String, to next: PreviewZoom) -> some View {
        Button {
            zoom = next
        } label: {
            Image(systemName: symbol)
                .font(.system(size: 9, weight: .bold))
                .frame(width: 22, height: 24)
                .contentShape(Rectangle())
        }
        .buttonStyle(.studioPlain)
    }
}
