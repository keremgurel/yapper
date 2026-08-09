import SwiftUI

/// The overlays pane: what is laid over the speaker, and the controls for
/// whichever one is selected.
///
/// Asking for an overlay in words happens in Chirpy and nowhere else. There used
/// to be a second box here, which meant two implementations of the same thing
/// and two places for the `@` list to be cut off by something — and this one sat
/// at the top of a scrolling pane, which is the worst place in the editor to
/// hang a list from.
struct OverlayWorkbench: View {
    @ObservedObject var session: EditorSession

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                header

                if session.overlays.isEmpty {
                    emptyState
                } else {
                    OverlayStrip(session: session)
                    if let overlay = session.selectedOverlay {
                        Divider()
                        OverlayInspectorView(session: session, overlay: overlay)
                    }
                }
            }
            .padding(16)
            .frame(maxWidth: 680, alignment: .leading)
        }
        .inspectorPane(maxWidth: 680)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text("Overlays")
                .font(.studioSectionTitle)
            Text("Images and cutaways laid over the speaker. Drag one on the player to move it, pull a corner to resize.")
                .font(.studioCaption)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var emptyState: some View {
        VStack(alignment: .leading, spacing: 9) {
            Label("No overlays yet", systemImage: "rectangle.on.rectangle")
                .font(.studioBodyStrong)
            Text("Import an image or a clip in Media, then add it as an overlay — or ask Chirpy where your files belong and let him place them against the transcript.")
                .font(.studioCaption)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(14)
        .frame(maxWidth: 480, alignment: .leading)
        .background(Color.raisedBackground)
        .overlay {
            RoundedRectangle(cornerRadius: 8)
                .stroke(Color.studioLine, lineWidth: 1)
        }
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

/// Every overlay on the timeline, in the order it plays.
private struct OverlayStrip: View {
    @ObservedObject var session: EditorSession

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            Text("PLACED")
                .font(.studioCaptionStrong)
                .foregroundStyle(.secondary)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 7) {
                    ForEach(sorted) { overlay in
                        OverlayChip(
                            name: session.media(for: overlay)?.name ?? "Overlay",
                            overlay: overlay,
                            thumbnail: session.thumbnailsByMedia[overlay.mediaID]?.first,
                            selected: session.selectedOverlayID == overlay.id
                        ) {
                            session.revealOverlay(overlay)
                        }
                    }
                }
                .padding(.vertical, 1)
            }
        }
    }

    private var sorted: [ProjectOverlay] {
        session.overlays.sorted { $0.timelineStart < $1.timelineStart }
    }
}

private struct OverlayChip: View {
    let name: String
    let overlay: ProjectOverlay
    let thumbnail: CGImage?
    let selected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Group {
                    if let thumbnail {
                        Image(decorative: thumbnail, scale: 1)
                            .resizable()
                            .scaledToFill()
                    } else {
                        Rectangle().fill(Color.black)
                    }
                }
                .frame(width: 38, height: 38)
                .clipShape(RoundedRectangle(cornerRadius: 5, style: .continuous))

                VStack(alignment: .leading, spacing: 3) {
                    Text(name)
                        .font(.studioBodyStrong)
                        .lineLimit(1)
                    Text("\(formatTime(overlay.timelineStart)) · \(String(format: "%.1fs", overlay.duration))")
                        .font(.studioCaption)
                        .foregroundStyle(.secondary)
                }
            }
            .padding(.horizontal, 9)
            .frame(width: 186, height: 52, alignment: .leading)
            .background(selected ? Color.studioSelectedFill : Color.raisedBackground)
            .overlay {
                RoundedRectangle(cornerRadius: 7)
                    .stroke(selected ? Color.yapperOrange.opacity(0.8) : Color.studioLine, lineWidth: 1)
            }
            .clipShape(RoundedRectangle(cornerRadius: 7))
        }
        .buttonStyle(.studioPlain)
        .clickableCursor()
    }
}
