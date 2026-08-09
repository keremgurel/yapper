import SwiftUI

/// Cropping, given the window.
///
/// The inspector's crop well is 260 points wide, which is fine for checking a
/// crop and miserable for making one: the corners are a few points apart and
/// the picture is too small to see what you are cutting off. This is the same
/// editor with room to aim in, opened from wherever the file is: the bin, the
/// timeline, or the inspector.
struct CropSheet: View {
    @ObservedObject var session: EditorSession
    let request: CropRequest

    /// Held here and written on every gesture, so the preview behind the sheet
    /// follows along and the crop can be abandoned by pressing Escape without
    /// having touched anything else.
    @State private var crop: OverlayCrop

    init(session: EditorSession, request: CropRequest) {
        self.session = session
        self.request = request
        _crop = State(initialValue: request.crop)
    }

    private var mediaAspect: Double {
        session.project.media
            .first { $0.id == request.mediaID }
            .map(CompositionBuilder.aspect(of:)) ?? 1
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            header

            CropCanvas(
                image: session.thumbnailsByMedia[request.mediaID]?.first,
                mediaAspect: mediaAspect,
                crop: crop,
                onChange: { crop = $0 },
                onCommit: { committed in
                    crop = committed
                    session.applyCrop(committed, to: request)
                }
            )
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            footer
        }
        .padding(18)
        .frame(minWidth: 620, idealWidth: 760, minHeight: 520, idealHeight: 620)
        .background(Color.panelBackground)
    }

    private var header: some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            VStack(alignment: .leading, spacing: 2) {
                Text("Crop \(request.name)")
                    .font(.system(size: 15, weight: .bold))
                Text(request.subtitle)
                    .font(.studioCaption)
                    .foregroundStyle(.secondary)
            }
            Spacer(minLength: 8)
            Text(readout)
                .font(.studioCaption)
                .foregroundStyle(.secondary)
                .monospacedDigit()
        }
    }

    private var footer: some View {
        HStack(spacing: 9) {
            Button("Reset") {
                crop = .full
                session.applyCrop(.full, to: request)
            }
            .buttonStyle(EditorSecondaryButtonStyle())
            .disabled(crop.isFull)

            Spacer(minLength: 0)

            Button("Done") { session.endCropping() }
                .buttonStyle(EditorPrimaryButtonStyle())
                .keyboardShortcut(.defaultAction)
        }
    }

    private var readout: String {
        "\(Int((crop.width * 100).rounded()))% × \(Int((crop.height * 100).rounded()))% of the picture"
    }
}
