import SwiftUI

/// The effects that ship with Yapper, on the library page beside the creator's
/// own files.
///
/// They belong here. A library that showed only what you imported would leave
/// the whoosh you use on every video somewhere else entirely, and "where do I
/// find my sounds" would have two answers.
struct BundledAudioShelf: View {
    let category: SoundEffectCategory
    let effects: [SoundEffectDescriptor]
    let playingID: String?
    let canAddToProject: Bool
    let onToggle: (SoundEffectDescriptor) -> Void
    let onAdd: (SoundEffectDescriptor) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 7) {
                Label(category.title, systemImage: category.icon)
                    .font(.studioCaptionStrong)
                    .foregroundStyle(.secondary)
                Text("\(effects.count)")
                    .font(.studioCaption)
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 1)
                    .background { Capsule().fill(Color.studioRaisedChip) }
            }

            VStack(spacing: 6) {
                ForEach(effects) { effect in
                    BundledAudioRow(
                        effect: effect,
                        isPlaying: playingID == effect.id,
                        canAddToProject: canAddToProject,
                        onToggle: { onToggle(effect) },
                        onAdd: { onAdd(effect) }
                    )
                }
            }
        }
    }
}

/// One shipped effect, drawn exactly as a saved one is.
private struct BundledAudioRow: View {
    let effect: SoundEffectDescriptor
    let isPlaying: Bool
    let canAddToProject: Bool
    let onToggle: () -> Void
    let onAdd: () -> Void

    var body: some View {
        AudioLibraryRowShell(
            subtitle: "\(effect.detail) · \(AudioLength.short(effect.duration))",
            isPlaying: isPlaying,
            onToggle: onToggle
        ) {
            Text(effect.name)
                .font(.studioBodyStrong)
                .lineLimit(1)
                .truncationMode(.middle)
        } trailing: { isHovering in
            AddToProjectButton(
                canAdd: canAddToProject,
                prominent: isHovering || isPlaying,
                action: onAdd
            )
        }
    }
}
