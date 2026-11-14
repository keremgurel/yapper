import SwiftUI

/// The shipped sound effects: a search, then each category as a grid.
struct SoundEffectsSection: View {
    @ObservedObject var session: EditorSession
    @State private var search = ""

    private var matches: [SoundEffectDescriptor] {
        AudioLibraryFilter.entries(
            AudioEntry.all(saved: []), section: .builtIn, search: search
        ).compactMap(\.effect)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            AudioSectionHeading(
                title: "Sound effects",
                detail: "Preview first, then place one at the playhead."
            )

            AudioSearchField(search: $search, prompt: "Search sound effects")

            let found = matches
            if found.isEmpty {
                noMatches
            }

            ForEach(SoundEffectCategory.allCases) { category in
                let effects = found.filter { $0.category == category }
                if !effects.isEmpty {
                    VStack(alignment: .leading, spacing: AudioWorkbenchMetrics.headingSpacing) {
                        Label(category.title, systemImage: category.icon)
                            .font(.studioCaptionStrong)
                            .foregroundStyle(.secondary)

                        LazyVGrid(
                            columns: AudioWorkbenchMetrics.columns,
                            alignment: .leading,
                            spacing: AudioWorkbenchMetrics.gridSpacing
                        ) {
                            ForEach(effects) { effect in
                                card(effect)
                            }
                        }
                    }
                    .padding(.top, 4)
                }
            }
        }
    }

    private func card(_ effect: SoundEffectDescriptor) -> some View {
        AudioItemCard(
            icon: effect.icon,
            title: effect.name,
            detail: effect.detail,
            disabled: session.project.clips.isEmpty,
            isPlaying: session.previewingSoundID == effect.id
        ) {
            if session.previewingSoundID == effect.id {
                session.stopSoundPreview()
            } else {
                Task { await session.previewSoundEffect(effect) }
            }
        } add: {
            Task { await session.addSoundEffect(effect) }
        }
    }

    private var noMatches: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("No sound effects match \"\(search)\".")
                .font(.studioBodyStrong)
            Text("Try a name, description or category, such as pop, cash register or whooshes.")
                .font(.studioCaption)
                .foregroundStyle(.secondary)
            Button("Clear search") { search = "" }
                .buttonStyle(EditorGhostButtonStyle())
                .padding(.leading, -8)
        }
    }
}
