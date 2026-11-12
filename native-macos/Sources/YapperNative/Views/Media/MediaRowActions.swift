import SwiftUI

/// The two places a file can go, the trim toggle, and the menu with
/// everything else.
struct MediaRowActions: View {
    let session: EditorSession
    let media: ProjectMedia
    let canOverlay: Bool
    /// The part to add, when the file has been trimmed. Nil adds all of it.
    let range: MediaTrimRange?
    /// Nil for a file with nothing to trim, such as a picture.
    let isTrimming: Bool?
    let onToggleTrim: () -> Void

    private var part: String { range == nil ? "" : "selection " }

    var body: some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: 6) {
                trimButton
                addButtons(main: "Add \(part)to main track", overlay: "Add \(part)as overlay")
                moreMenu
            }
            .fixedSize()
            HStack(spacing: 6) {
                trimButton
                addButtons(main: "Main track", overlay: "Overlay")
                moreMenu
            }
            .fixedSize()
            // The narrowest pane: where a file goes on one line, what else can
            // be done to it on the next.
            VStack(alignment: .leading, spacing: 6) {
                addButtons(main: "Main track", overlay: "Overlay")
                HStack(spacing: 6) {
                    trimButton
                    moreMenu
                }
            }
            .fixedSize()
        }
    }

    @ViewBuilder
    private var trimButton: some View {
        if let isTrimming {
            Button(action: onToggleTrim) {
                StudioGlyphLabel(isTrimming ? "Hide trim" : "Trim", glyph: .split, size: 13)
            }
            .buttonStyle(EditorGhostButtonStyle(size: .small))
            .help(isTrimming
                ? "Close the trim strip. The part you chose is kept."
                : "Choose the part of this file to add, before it goes on the timeline")
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
