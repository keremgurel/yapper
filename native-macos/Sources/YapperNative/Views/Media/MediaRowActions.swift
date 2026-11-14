import SwiftUI

/// The two places a file can go, and the menu with everything else.
struct MediaRowActions: View {
    let session: EditorSession
    let media: ProjectMedia
    let canOverlay: Bool
    /// The part to add, when the file has been trimmed. Nil adds all of it.
    let range: MediaTrimRange?

    private var part: String { range == nil ? "" : "selection " }

    var body: some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: 6) {
                addButtons(main: "Add \(part)to main track", overlay: "Add \(part)as overlay")
                moreMenu
            }
            .fixedSize()
            HStack(spacing: 6) {
                addButtons(main: "Main track", overlay: "Overlay")
                moreMenu
            }
            .fixedSize()
        }
    }

    private func addButtons(main: String, overlay: String) -> some View {
        HStack(spacing: 6) {
            Button {
                Task { await session.appendMediaToTimeline(media.id, range: range) }
            } label: {
                StudioGlyphLabel(main, glyph: .plus, size: 13)
            }
            .buttonStyle(EditorSecondaryButtonStyle(size: .small))
            .disabled(media.isScene)
            .help(mainHelp)
            .accessibilityLabel("Add \(part)to main track")

            Button {
                Task { await session.addOverlay(media.id, range: range) }
            } label: {
                StudioGlyphLabel(overlay, glyph: .overlays, size: 13)
            }
            .buttonStyle(EditorSecondaryButtonStyle(size: .small))
            .disabled(!canOverlay)
            .help(overlayHelp)
            .accessibilityLabel("Add \(part)as overlay")
        }
    }

    private var moreMenu: some View {
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

    private var mainHelp: String {
        if media.isImage {
            return "Add this picture to the end of the main track, holding for \(Int(EditorSession.imageClipDefaultDuration))s"
        }
        if let range {
            return "Add the chosen \(MediaTrimTime.length(range.length)) to the end of the main track"
        }
        return "Add this clip to the end of the main track"
    }

    private var overlayHelp: String {
        guard canOverlay else { return "Add a clip to the main track first" }
        if let range {
            return "Put the chosen \(MediaTrimTime.length(range.length)) on top of the video at the playhead"
        }
        return "Put this on top of the video at the playhead"
    }
}
