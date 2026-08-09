import SwiftUI

/// The sounds themselves, in as many columns as the window has room for.
///
/// Adaptive rather than fixed: this page is as wide as the app, and a single
/// column of full-width rows wasted most of it while making twenty sounds a
/// scroll. Headings only appear when a shelf holds more than one group, since a
/// filtered shelf is already named in the rail.
struct AudioLibraryGrid: View {
    let entries: [AudioEntry]
    let missingIDs: Set<UUID>
    let playingID: String?
    let canAddToProject: Bool
    let onToggle: (AudioEntry) -> Void
    let onAdd: (AudioEntry) -> Void
    let onRename: (AudioEntry, String) -> Void
    let onSetKind: (AudioEntry, SavedAudioKind) -> Void
    let onDelete: (AudioEntry) -> Void

    private let columns = [
        GridItem(.adaptive(minimum: 236, maximum: 340), spacing: 10, alignment: .top),
    ]

    var body: some View {
        let groups = AudioLibraryFilter.groups(entries)
        VStack(alignment: .leading, spacing: 16) {
            ForEach(groups, id: \.title) { group in
                VStack(alignment: .leading, spacing: 8) {
                    if groups.count > 1 {
                        Text(group.title.uppercased())
                            .font(.studioCaptionStrong)
                            .foregroundStyle(.secondary)
                    }
                    LazyVGrid(columns: columns, alignment: .leading, spacing: 10) {
                        ForEach(group.entries) { entry in
                            card(entry)
                        }
                    }
                }
            }
        }
    }

    private func card(_ entry: AudioEntry) -> some View {
        AudioEntryCard(
            entry: entry,
            isPlaying: playingID == entry.id,
            isMissing: entry.saved.map { missingIDs.contains($0.id) } ?? false,
            canAddToProject: canAddToProject,
            onToggle: { onToggle(entry) },
            onAdd: { onAdd(entry) },
            onRename: { onRename(entry, $0) },
            onSetKind: { onSetKind(entry, $0) },
            onDelete: { onDelete(entry) }
        )
    }
}
