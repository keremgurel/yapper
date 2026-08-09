import SwiftUI

/// One kind of audio, with its heading.
///
/// Empty shelves still draw, with the line that says what belongs on them. A
/// library that hides everything it does not have yet is a library nobody
/// learns the shape of.
struct AudioLibraryShelf: View {
    let kind: SavedAudioKind
    let items: [SavedAudio]
    let missingIDs: Set<UUID>
    let playingID: UUID?
    let canAddToProject: Bool
    let onToggle: (SavedAudio) -> Void
    let onAdd: (SavedAudio) -> Void
    let onRename: (SavedAudio, String) -> Void
    let onSetKind: (SavedAudio, SavedAudioKind) -> Void
    let onDelete: (SavedAudio) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 7) {
                Label(kind.title, systemImage: kind.icon)
                    .font(.studioCaptionStrong)
                    .foregroundStyle(.secondary)
                if !items.isEmpty {
                    Text("\(items.count)")
                        .font(.studioCaption)
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 1)
                        .background {
                            Capsule().fill(Color.studioRaisedChip)
                        }
                }
            }

            if items.isEmpty {
                Text(kind.hint)
                    .font(.studioCaption)
                    .foregroundStyle(.tertiary)
                    .padding(.vertical, 6)
            } else {
                VStack(spacing: 6) {
                    ForEach(items) { item in
                        SavedAudioRow(
                            item: item,
                            isPlaying: playingID == item.id,
                            isMissing: missingIDs.contains(item.id),
                            canAddToProject: canAddToProject,
                            onToggle: { onToggle(item) },
                            onAdd: { onAdd(item) },
                            onRename: { onRename(item, $0) },
                            onSetKind: { onSetKind(item, $0) },
                            onDelete: { onDelete(item) }
                        )
                    }
                }
            }
        }
    }
}
