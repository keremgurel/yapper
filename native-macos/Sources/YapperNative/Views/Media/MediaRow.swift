import SwiftUI

/// One file in the bin.
struct MediaRow: View {
    /// Held, not observed: everything the row draws with arrives as a value, so
    /// a waveform finishing on one file does not re-run the body of every other.
    let session: EditorSession
    let media: ProjectMedia
    let thumbnail: CGImage?
    let waveformProgress: Double?
    let isSelected: Bool
    let canOverlay: Bool
    let onClick: (MediaSelection.Modifier) -> Void

    var body: some View {
        HStack(spacing: 10) {
            preview
            details
            Spacer(minLength: 0)
            actions
        }
        .padding(9)
        .background(isSelected ? Color.yapperOrange.opacity(0.16) : Color.raisedBackground)
        .overlay {
            RoundedRectangle(cornerRadius: 9, style: .continuous)
                .strokeBorder(
                    isSelected ? Color.yapperOrange.opacity(0.75) : .clear,
                    lineWidth: 1.5
                )
        }
        .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
        .contentShape(Rectangle())
        // The whole row is the target, so picking several is a run of ordinary
        // clicks rather than a hunt for a checkbox.
        .onTapGesture { onClick(MediaRow.modifier()) }
        .contextMenu { MediaActions(session: session, media: media, canOverlay: canOverlay) }
    }

    /// What the keyboard was saying when the click landed.
    static func modifier() -> MediaSelection.Modifier {
        let flags = NSEvent.modifierFlags
        if flags.contains(.shift) { return .extend }
        if flags.contains(.command) { return .toggle }
        return .none
    }

    private var preview: some View {
        Group {
            if let thumbnail {
                Image(decorative: thumbnail, scale: 1)
                    .resizable()
                    .scaledToFill()
            } else {
                Rectangle().fill(Color.black)
                    .overlay(ProgressView().controlSize(.small))
            }
        }
        .frame(width: 112, height: 64)
        .clipped()
        .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
    }

    private var details: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(media.name)
                .font(.studioBodyStrong)
                .lineLimit(2)
            if let generated = media.generated {
                Text(generated.description)
                    .font(.studioCaption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
                    .help("Mention @\(media.name) in Chirpy to request changes")
            }
            Text("\(media.width)×\(media.height) · \(formatTime(media.duration))")
                .font(.studioCaption)
                .foregroundStyle(.secondary)
            if let waveformProgress, waveformProgress < 1 {
                ProgressView(value: waveformProgress).tint(.cyan)
            } else if !media.isImage {
                Label("Waveform ready", systemImage: "waveform")
                    .font(.studioCaption)
                    .foregroundStyle(.cyan)
            }
        }
        .frame(minWidth: 0, alignment: .leading)
    }

    private var actions: some View {
        HStack(spacing: 6) {
            Button {
                Task { await session.appendMediaToTimeline(media.id) }
            } label: {
                AdaptiveControlLabel(
                    title: "Add to main track",
                    systemImage: "rectangle.stack.badge.plus",
                    compactTitle: "Add"
                )
            }
            .buttonStyle(EditorSecondaryButtonStyle(size: .small))
            .disabled(media.isScene)
            .help(media.isImage
                ? "Add this picture to the timeline, holding for \(Int(EditorSession.imageClipDefaultDuration))s"
                : "Add this clip to the end of the timeline")
            Button {
                Task { await session.addOverlay(media.id) }
            } label: {
                AdaptiveControlLabel(
                    title: "Add as overlay",
                    systemImage: "rectangle.on.rectangle",
                    compactTitle: "Overlay"
                )
            }
            .buttonStyle(EditorSecondaryButtonStyle(size: .small))
            .disabled(!canOverlay)
            .help(canOverlay ? "Add this media as an overlay" : "Add a clip to the main track first")

            Menu {
                MediaActions(session: session, media: media, canOverlay: canOverlay)
            } label: {
                Image(systemName: "ellipsis")
                    .font(.system(size: 12, weight: .bold))
                    .frame(width: 28, height: 28)
            }
            .menuStyle(.borderlessButton)
            .menuIndicator(.hidden)
            .help("Media actions")
        }
    }
}

/// What can be done to one file, in the menu and in the context menu alike.
struct MediaActions: View {
    let session: EditorSession
    let media: ProjectMedia
    let canOverlay: Bool

    var body: some View {
        if !media.isImage {
            Button {
                Task { await session.appendMediaToTimeline(media.id) }
            } label: {
                Label("Add to main track", systemImage: "rectangle.stack.badge.plus")
            }
        }

        Button {
            Task { await session.addOverlay(media.id) }
        } label: {
            Label("Add as overlay", systemImage: "rectangle.on.rectangle")
        }
        .disabled(!canOverlay)

        // Cropping a file in the bin means every cutaway made from it: see
        // CropRequest. Offered whether or not it is on the timeline yet, and
        // says which it is rather than being greyed out for a reason nobody
        // can see from here.
        Button {
            session.beginCropping(mediaID: media.id)
        } label: {
            Label("Crop…", systemImage: "crop")
        }
        .disabled(!session.canCrop(mediaID: media.id))

        if !media.isImage {
            Divider()
            Button {
                Task { await session.resetMediaToSource(media.id) }
            } label: {
                Label("Reset this media to source", systemImage: "arrow.counterclockwise")
            }
        }

        Divider()
        Button(role: .destructive) {
            Task { await session.deleteImportedMedia(media.id) }
        } label: {
            Label("Remove from project", systemImage: "trash")
        }
    }
}
