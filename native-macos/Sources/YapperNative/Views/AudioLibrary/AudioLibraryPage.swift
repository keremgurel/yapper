import SwiftUI
import UniformTypeIdentifiers

/// The Audio tab: every sound the creator can reach, in one place.
///
/// Two halves, and only one of them is theirs. Yours is what they imported,
/// shelved by what it is for. Built in is the catalogue that ships with Yapper.
/// Both are here because "where are my sounds" has to have one answer: a
/// library that listed only the imports would leave the whoosh used on every
/// video somewhere else entirely.
///
/// Desktop only, and it could not be anything else. The saved half is a folder
/// of real files on this Mac that the timeline opens directly, which is why
/// importing a music bed costs nothing and playing one starts instantly.
struct AudioLibraryPage: View {
    @ObservedObject var session: EditorSession
    @ObservedObject var store: AudioLibraryStore
    /// Called once a sound has landed on the timeline, so the creator ends up
    /// looking at it rather than at the shelf it came from.
    let onOpenEditor: () -> Void

    @StateObject private var preview = SavedAudioPreview()
    @State private var isDropTargeted = false

    private var canAddToProject: Bool {
        !session.project.clips.isEmpty
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                header

                if let message = store.errorMessage {
                    banner(message)
                }

                if let name = store.importingName {
                    HStack(spacing: 8) {
                        ProgressView().controlSize(.small)
                        Text("Importing \(name)…")
                            .font(.studioCaption)
                            .foregroundStyle(.secondary)
                    }
                }

                yours
                Divider()
                builtIn
            }
            .frame(maxWidth: 720, alignment: .leading)
            .padding(.horizontal, 28)
            .padding(.vertical, 22)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(Color.editorBackground)
        .overlay {
            if isDropTargeted {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .strokeBorder(Color.yapperOrange, style: StrokeStyle(lineWidth: 2, dash: [7, 5]))
                    .padding(10)
                    .allowsHitTesting(false)
            }
        }
        .onDrop(of: [.fileURL], isTargeted: $isDropTargeted) { providers in
            Task { await store.add(await DroppedFiles.urls(from: providers)) }
            return true
        }
        // A preview is a sound playing out of a page that is no longer on
        // screen. Leaving the tab has to end it.
        .onDisappear(perform: preview.stop)
    }

    private var header: some View {
        HStack(alignment: .top, spacing: 16) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Audio library")
                    .font(.studioSectionTitle)
                Text("Everything you can drop on a timeline: yours and Yapper's.")
                    .font(.studioCaption)
                    .foregroundStyle(.secondary)
            }
            Spacer(minLength: 8)
            Button(action: importAudio) {
                Label("Import audio", systemImage: "square.and.arrow.down")
            }
            .buttonStyle(EditorSecondaryButtonStyle())
        }
    }

    /// The creator's own files. Empty until they import something, and saying
    /// so plainly rather than hiding, because the shelves are how they learn
    /// this is a place their own music goes.
    @ViewBuilder
    private var yours: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("YOURS")
                .font(.studioCaptionStrong)
                .foregroundStyle(.secondary)

            if store.items.isEmpty {
                AudioLibraryEmptyState(onImport: importAudio)
            } else {
                ForEach(SavedAudioKind.allCases) { kind in
                    AudioLibraryShelf(
                        kind: kind,
                        items: store.items(of: kind),
                        missingIDs: store.missingIDs,
                        playingID: preview.playingID,
                        canAddToProject: canAddToProject,
                        onToggle: { preview.toggle($0, at: store.url(for: $0)) },
                        onAdd: add,
                        onRename: { store.rename($0.id, to: $1) },
                        onSetKind: { store.setKind($1, for: $0.id) },
                        onDelete: delete
                    )
                }
            }
        }
    }

    /// The shipped catalogue, on the same page and shelved the way it always
    /// has been in the editor.
    private var builtIn: some View {
        VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 3) {
                Text("BUILT IN")
                    .font(.studioCaptionStrong)
                    .foregroundStyle(.secondary)
                Text("Levelled to one loudness, so any two of them sit together.")
                    .font(.studioCaption)
                    .foregroundStyle(.secondary)
            }

            ForEach(SoundEffectCategory.allCases) { category in
                let effects = SoundEffectDescriptor.library(in: category)
                if !effects.isEmpty {
                    BundledAudioShelf(
                        category: category,
                        effects: effects,
                        playingID: preview.playingID,
                        canAddToProject: canAddToProject,
                        onToggle: { preview.toggle($0) },
                        onAdd: addEffect
                    )
                }
            }
        }
    }

    private func banner(_ message: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(Color.studioDanger)
            Text(message)
                .font(.studioCaption)
            Spacer(minLength: 8)
            Button("Dismiss") { store.errorMessage = nil }
                .buttonStyle(EditorGhostButtonStyle())
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 9)
        .background {
            RoundedRectangle(cornerRadius: 9, style: .continuous)
                .fill(Color.studioDanger.opacity(0.12))
        }
    }

    private func importAudio() {
        ImportPanels.openLibraryAudio(into: store)
    }

    private func add(_ item: SavedAudio) {
        guard canAddToProject else { return }
        preview.stop()
        Task {
            await session.addSavedAudio(item, at: store.url(for: item))
            onOpenEditor()
        }
    }

    private func addEffect(_ effect: SoundEffectDescriptor) {
        guard canAddToProject else { return }
        preview.stop()
        Task {
            await session.addSoundEffect(effect)
            onOpenEditor()
        }
    }

    private func delete(_ item: SavedAudio) {
        if preview.isPlaying(item) { preview.stop() }
        store.remove(item.id)
    }
}
