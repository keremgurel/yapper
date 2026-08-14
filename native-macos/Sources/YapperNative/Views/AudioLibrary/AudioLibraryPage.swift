import SwiftUI
import UniformTypeIdentifiers

/// The Audio tab: every sound the creator can reach, in one place.
///
/// A rail of shelves, a search field, and a grid that uses the width the window
/// actually has. Both halves of the library are in it: what the creator
/// imported and what ships with Yapper, because "where do I find my sounds" has
/// to have one answer.
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
    @State private var section: AudioLibrarySection = .all
    @State private var search = ""
    @State private var isDropTargeted = false

    private var entries: [AudioEntry] {
        AudioEntry.all(saved: store.items)
    }

    private var canAddToProject: Bool {
        !session.project.clips.isEmpty
    }

    var body: some View {
        VStack(spacing: 0) {
            header
            Divider()
            HStack(alignment: .top, spacing: 0) {
                ScrollView {
                    AudioLibraryRail(entries: entries, search: search, section: $section)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 14)
                }
                .frame(width: 210)
                .background(Color.panelBackground)

                Divider()
                content
            }
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
            Task {
                do {
                    let added = try await store.add(await DroppedFiles.urls(from: providers))
                    try Task.checkCancellation()
                    // Land the creator on what they just dropped rather than on
                    // whichever shelf they happened to be looking at.
                    if let first = added.first { section = .savedKind(first.kind) }
                } catch is CancellationError {
                    return
                } catch {
                    store.errorMessage = error.localizedDescription
                }
            }
            return true
        }
        // A preview is a sound playing out of a page that is no longer on
        // screen. Leaving the tab has to end it.
        .onDisappear(perform: preview.stop)
    }

    private var header: some View {
        HStack(spacing: 14) {
            VStack(alignment: .leading, spacing: 2) {
                Text("Audio library")
                    .font(.studioSectionTitle)
                Text("Everything you can drop on a timeline: yours and Yapper's.")
                    .font(.studioCaption)
                    .foregroundStyle(.secondary)
            }

            Spacer(minLength: 12)

            searchField

            Button(action: importAudio) {
                Label("Import audio", systemImage: "square.and.arrow.down")
            }
            .buttonStyle(EditorSecondaryButtonStyle())
            .disabled(store.isRecovering)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 14)
    }

    private var searchField: some View {
        HStack(spacing: 6) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(.secondary)
            TextField("Search sounds", text: $search)
                .textFieldStyle(.plain)
                .font(.studioBody)
                .frame(width: 150)
            if !search.isEmpty {
                Button {
                    search = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 11))
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.studioPlain)
                .clickableCursor()
            }
        }
        .padding(.horizontal, 9)
        .frame(height: 28)
        .background {
            Capsule().fill(Color.studioInputBackground)
                .overlay { Capsule().strokeBorder(Color.studioLine, lineWidth: 1) }
        }
    }

    @ViewBuilder
    private var content: some View {
        let shown = AudioLibraryFilter.entries(entries, section: section, search: search)
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if let message = store.errorMessage {
                    banner(message)
                }

                if store.isRecovering {
                    HStack(spacing: 8) {
                        ProgressView().controlSize(.small)
                        Text("Checking your audio library…")
                            .font(.studioCaption)
                            .foregroundStyle(.secondary)
                    }
                }

                if let name = store.importingName {
                    HStack(spacing: 8) {
                        ProgressView().controlSize(.small)
                        Text("Importing \(name)…")
                            .font(.studioCaption)
                            .foregroundStyle(.secondary)
                    }
                }

                if shown.isEmpty {
                    empty
                } else {
                    AudioLibraryGrid(
                        entries: shown,
                        missingIDs: store.missingIDs,
                        playingID: preview.playingID,
                        canAddToProject: canAddToProject,
                        onToggle: toggle,
                        onAdd: add,
                        onRename: { entry, name in
                            guard let item = entry.saved else { return }
                            Task { await store.rename(item.id, to: name) }
                        },
                        onSetKind: { entry, kind in
                            guard let item = entry.saved else { return }
                            Task { await store.setKind(kind, for: item.id) }
                        },
                        onDelete: delete
                    )
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 16)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    /// Nothing to show, which means one of two things, and they need different
    /// answers: a search that found nothing, or a shelf of the creator's that
    /// is waiting for its first import.
    @ViewBuilder
    private var empty: some View {
        if !search.isEmpty {
            VStack(alignment: .leading, spacing: 6) {
                Text("Nothing here matches “\(search)”.")
                    .font(.studioBody)
                Button("Search everything") {
                    section = .all
                }
                .buttonStyle(EditorGhostButtonStyle())
            }
            .padding(.vertical, 28)
        } else {
            AudioLibraryEmptyState(onImport: importAudio)
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

    private func toggle(_ entry: AudioEntry) {
        switch entry.source {
        case let .saved(item):
            preview.toggle(item, at: store.url(for: item))
        case let .bundled(effect):
            preview.toggle(effect)
        }
    }

    private func add(_ entry: AudioEntry) {
        guard canAddToProject else { return }
        preview.stop()
        Task {
            switch entry.source {
            case let .saved(item):
                await session.addSavedAudio(item, from: store)
            case let .bundled(effect):
                await session.addSoundEffect(effect)
            }
            onOpenEditor()
        }
    }

    private func delete(_ entry: AudioEntry) {
        guard let item = entry.saved else { return }
        Task {
            let removed = await session.removeSavedAudio(item, from: store)
            if removed, preview.playingID == entry.id { preview.stop() }
        }
    }
}
