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
    /// The part of each file chosen so far. Kept after its strip is closed, so
    /// the choice is still there when the strip comes back.
    @State private var trims: [UUID: MediaTrimRange] = [:]
    /// Whether the list is narrowed to the files not on the timeline yet.
    @State private var showsOnlyUnplaced = false

    /// The one file picked, whose trim strip is open. Picking several is for
    /// acting on them together, so no strip shows then.
    private var trimmingID: UUID? {
        session.mediaSelection.count == 1 ? session.mediaSelection.ids.first : nil
    }

    private var usage: [UUID: MediaUsage] {
        MediaUsage.byMedia(clips: session.project.clips, overlays: session.overlays)
    }

    private var canOverlay: Bool { !session.project.clips.isEmpty }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            header
            // One file's actions are on its own row. The bar is for several.
            if session.mediaSelection.count > 1 {
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
        WorkbenchPaneHeader(
            title: "Media",
            detail: "Click a file to trim it before adding. Drop more in from Finder."
        ) {
            Button {
                ImportPanels.openMedia(for: session)
            } label: {
                StudioGlyphLabel("Import", glyph: .plus, size: 13)
            }
            .buttonStyle(EditorSecondaryButtonStyle(size: .small))
            .disabled(session.isBusy)
            .help("Choose videos, pictures or audio to add to this project")
        }
    }

    private var list: some View {
        let usage = usage
        let all = session.project.media
        let unplaced = all.filter { usage[$0.id]?.isPlaced != true }
        let shown = showsOnlyUnplaced ? unplaced : all
        return VStack(alignment: .leading, spacing: 10) {
            // Only once the question exists: some placed, some not.
            if !unplaced.isEmpty, unplaced.count < all.count {
                InspectorSegmentedControl(
                    options: [
                        .init(value: false, label: "All \(all.count)"),
                        .init(value: true, label: "Not placed \(unplaced.count)"),
                    ],
                    selection: showsOnlyUnplaced
                ) { showsOnlyUnplaced = $0 }
            }
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 8) {
                    ForEach(shown) { media in
                        MediaRow(
                            session: session,
                            media: media,
                            thumbnails: session.thumbnailsByMedia[media.id] ?? [],
                            waveform: session.waveformByMedia[media.id] ?? [],
                            waveformProgress: session.waveformProgressByMedia[media.id],
                            isSelected: session.isMediaSelected(media.id),
                            canOverlay: canOverlay,
                            trim: trimBinding(for: media),
                            isTrimming: trimmingID == media.id,
                            usage: usage[media.id] ?? .none,
                            onClick: { session.clickMedia(media.id, modifier: $0) }
                        )
                    }
                }
            }
        }
    }

    /// Only media with a length of its own can be trimmed: a picture or a
    /// generated visual has no start and end to move.
    private func trimBinding(for media: ProjectMedia) -> Binding<MediaTrimRange>? {
        guard !media.isImage, !media.isScene, media.duration > 0 else { return nil }
        return Binding(
            get: { trims[media.id] ?? MediaTrimRange(duration: media.duration) },
            set: { trims[media.id] = $0 }
        )
    }

    @ViewBuilder
    private var dropHighlight: some View {
        if isDropTargeted {
            RoundedRectangle(cornerRadius: StudioRadius.panel, style: .continuous)
                .fill(Color.studioAccent.opacity(0.09))
                .overlay {
                    RoundedRectangle(cornerRadius: StudioRadius.panel, style: .continuous)
                        .strokeBorder(
                            Color.studioAccent.opacity(0.7),
                            style: StrokeStyle(lineWidth: 2, dash: [7, 5])
                        )
                }
        }
    }
}
