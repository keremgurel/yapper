import SwiftUI
import UniformTypeIdentifiers

/// The media bin.
///
/// Files arrive by drop or by the Import button, are picked the way rows are
/// picked everywhere else on this machine, and are placed onto the timeline or
/// removed from here.
struct MediaWorkbench: View {
    @ObservedObject var session: EditorSession
    /// True while a Finder drag is over the panel, so the whole thing lights up
    /// rather than one row of it.
    @State private var isDropTargeted = false

    private var canOverlay: Bool { !session.project.clips.isEmpty }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            header
            if !session.mediaSelection.isEmpty {
                MediaSelectionBar(session: session)
            }
            if session.project.media.isEmpty {
                MediaEmptyState(session: session)
            } else {
                list
            }
            Spacer(minLength: 0)
        }
        .padding(16)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .contentShape(Rectangle())
        // A click on the panel itself, rather than on a row, means "none of
        // them" — the same thing it means in a Finder window.
        .onTapGesture { session.clearMediaSelection() }
        .background(dropHighlight)
        // The whole panel is the target. Aiming at a list that might be empty
        // is exactly the kind of precision a drop should not ask for.
        .dropDestination(for: URL.self) { urls, _ in
            Task { await session.importDropped(urls) }
            return true
        } isTargeted: {
            isDropTargeted = $0
        }
        .inspectorPane(maxWidth: 720)
    }

    private var header: some View {
        HStack {
            VStack(alignment: .leading, spacing: 3) {
                Text("Media")
                    .font(.system(size: 15, weight: .bold))
                Text("Drop files here · video stays local on this Mac")
                    .font(.studioBody)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Button("Import") { ImportPanels.openMedia(for: session) }
                .buttonStyle(EditorSecondaryButtonStyle())
        }
    }

    private var list: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 10) {
                ForEach(session.project.media) { media in
                    MediaRow(
                        session: session,
                        media: media,
                        thumbnail: session.thumbnailsByMedia[media.id]?.first,
                        waveformProgress: session.waveformProgressByMedia[media.id],
                        isSelected: session.isMediaSelected(media.id),
                        canOverlay: canOverlay,
                        onClick: { session.clickMedia(media.id, modifier: $0) }
                    )
                }
            }
        }
    }

    @ViewBuilder
    private var dropHighlight: some View {
        if isDropTargeted {
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(Color.yapperOrange.opacity(0.09))
                .overlay {
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .strokeBorder(
                            Color.yapperOrange.opacity(0.7),
                            style: StrokeStyle(lineWidth: 2, dash: [7, 5])
                        )
                }
        }
    }

}

/// What the panel says before anything has been imported.
struct MediaEmptyState: View {
    @ObservedObject var session: EditorSession

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: "plus.rectangle.on.rectangle")
                    .font(.system(size: 23, weight: .light))
                    .foregroundStyle(Color.yapperOrange)
                    .frame(width: 30)
                VStack(alignment: .leading, spacing: 4) {
                    Text("No media yet")
                        .font(.studioBodyStrong)
                    Text("Drag videos or images in from Finder, or import them. They stay local on this Mac.")
                        .font(.studioCaption)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }

            Button {
                ImportPanels.openMedia(for: session)
            } label: {
                Label("Import media", systemImage: "square.and.arrow.down")
            }
            .buttonStyle(EditorPrimaryButtonStyle())
        }
        .padding(16)
        .frame(maxWidth: 440, alignment: .leading)
        .background(Color.raisedBackground)
        .overlay(
            RoundedRectangle(cornerRadius: 9)
                .stroke(Color.studioLine, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 9))
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
