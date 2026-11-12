import SwiftUI

/// The two places a file can go, and the menu with everything else.
struct MediaRowActions: View {
    let session: EditorSession
    let media: ProjectMedia
    let canOverlay: Bool

    var body: some View {
        ViewThatFits(in: .horizontal) {
            buttons(main: "Add to main track", overlay: "Add as overlay")
            buttons(main: "Main track", overlay: "Overlay")
        }
    }

    private func buttons(main: String, overlay: String) -> some View {
        HStack(spacing: 6) {
            Button {
                Task { await session.appendMediaToTimeline(media.id) }
            } label: {
                StudioGlyphLabel(main, glyph: .plus, size: 13)
            }
            .buttonStyle(EditorSecondaryButtonStyle(size: .small))
            .disabled(media.isScene)
            .help(media.isImage
                ? "Add this picture to the end of the main track, holding for \(Int(EditorSession.imageClipDefaultDuration))s"
                : "Add this clip to the end of the main track")
            .accessibilityLabel("Add to main track")

            Button {
                Task { await session.addOverlay(media.id) }
            } label: {
                StudioGlyphLabel(overlay, glyph: .overlays, size: 13)
            }
            .buttonStyle(EditorSecondaryButtonStyle(size: .small))
            .disabled(!canOverlay)
            .help(canOverlay
                ? "Put this on top of the video at the playhead"
                : "Add a clip to the main track first")
            .accessibilityLabel("Add as overlay")

            Menu {
                MediaActions(session: session, media: media, canOverlay: canOverlay)
            } label: {
                StudioGlyph.image(.more, size: 16)
            }
            .menuStyle(.borderlessButton)
            .menuIndicator(.hidden)
            .frame(width: 28, height: 28)
            .help("Crop, reset or remove this file")
            .accessibilityLabel("Media actions")
        }
        .fixedSize()
    }
}
