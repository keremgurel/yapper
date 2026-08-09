import SwiftUI

/// The crop, in the inspector: a small view of what is kept, and the way to a
/// proper one.
///
/// The editing surface is shared with the sheet, so a crop nudged here and a
/// crop made there are the same gesture on the same picture. What differs is
/// the room: this is a well beside the other overlay controls, and past a
/// certain point aiming at a picture wants a window. See `CropSheet`.
struct OverlayCropEditor: View {
    @ObservedObject var session: EditorSession
    let overlay: ProjectOverlay

    private var mediaAspect: Double {
        session.media(for: overlay).map(CompositionBuilder.aspect(of:)) ?? 1
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            CropCanvas(
                image: session.thumbnailsByMedia[overlay.mediaID]?.first,
                mediaAspect: mediaAspect,
                crop: overlay.resolvedCrop,
                onCommit: { session.setOverlayCrop(overlay, crop: $0) }
            )
            .frame(maxWidth: 260)

            HStack(spacing: 8) {
                Button("Crop…") { session.beginCropping(overlayID: overlay.id) }
                    .buttonStyle(EditorSecondaryButtonStyle(size: .mini))
                    .help("Open the crop editor with room to aim in")

                Button("Reset crop") {
                    session.setOverlayCrop(overlay, crop: .full)
                }
                .buttonStyle(EditorSecondaryButtonStyle(size: .mini))
                .disabled(overlay.resolvedCrop.isFull)

                Spacer(minLength: 0)

                Text(readout)
                    .font(.studioCaption)
                    .foregroundStyle(.secondary)
                    .monospacedDigit()
            }
        }
    }

    private var readout: String {
        let crop = overlay.resolvedCrop
        return "\(Int((crop.width * 100).rounded()))% × \(Int((crop.height * 100).rounded()))%"
    }
}
