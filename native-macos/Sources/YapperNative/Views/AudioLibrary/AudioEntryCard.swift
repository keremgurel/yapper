import SwiftUI

/// A sound with separate preview, insertion and persistent default controls.
struct AudioEntryCard: View {
    let entry: AudioEntry
    let isPlaying: Bool
    let isMissing: Bool
    let canAddToProject: Bool
    let onToggle: () -> Void
    let onAdd: () -> Void
    /// Only saved sounds can be renamed, reshelved or deleted, so a shipped one
    /// gets no menu rather than a menu of disabled items.
    let onRename: (String) -> Void
    let onSetKind: (SavedAudioKind) -> Void
    let onDelete: () -> Void

    @State private var isHovering = false
    @State private var isRenaming = false
    @State private var draftName = ""
    @FocusState private var nameFocused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Button(action: onToggle) { icon }
                    .buttonStyle(.borderless)
                    .disabled(isMissing)
                    .accessibilityLabel(isPlaying ? "Stop preview of \(entry.name)" : "Preview \(entry.name)")
                title.help(entry.name)
                Spacer(minLength: 4)
                Text(AudioLength.short(entry.duration))
                    .font(.studioCaption)
                    .foregroundStyle(.secondary)
                    .monospacedDigit()
            }

            HStack(spacing: 6) {
                Text(isMissing ? "File missing" : entry.detail)
                    .font(.studioCaption)
                    .foregroundStyle(isMissing ? Color.studioDanger : .secondary)
                    .lineLimit(1)
                Spacer(minLength: 4)
                actions
            }

            AudioDefaultVolume(entryID: entry.id, name: entry.name)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 12)
        .frame(minHeight: 120)
        .background {
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(isHovering ? Color.studioFaintFill : Color.raisedBackground)
                .overlay {
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .strokeBorder(
                            isPlaying ? Color.yapperOrange : Color.studioLine,
                            lineWidth: isPlaying ? 1.5 : 1
                        )
                }
        }
        .contentShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        .onHover { isHovering = $0 }
        .animation(.easeOut(duration: 0.12), value: isHovering)
        .help(isMissing ? "This file is no longer on disk" : entry.name)
        .onChange(of: isRenaming) { _, renaming in
            if renaming {
                draftName = entry.name
                nameFocused = true
            } else {
                nameFocused = false
            }
        }
        .contextMenu {
            if entry.isSaved { savedActions }
        }
    }

    private var icon: some View {
        Image(systemName: isPlaying ? "stop.fill" : "play.fill")
            .font(.system(size: 10.5, weight: .bold))
            .foregroundStyle(isPlaying ? Color.white : Color.yapperOrange)
            .frame(width: 28, height: 28)
            .background {
                RoundedRectangle(cornerRadius: 6, style: .continuous)
                    .fill(isPlaying ? Color.yapperOrange : Color.yapperOrange.opacity(0.12))
            }
    }

    @ViewBuilder
    private var title: some View {
        if isRenaming {
            TextField("Name", text: $draftName)
                .textFieldStyle(.plain)
                .font(.studioBodyStrong)
                .focused($nameFocused)
                .onSubmit {
                    isRenaming = false
                    onRename(draftName)
                }
                .onExitCommand { isRenaming = false }
        } else {
            Text(entry.name)
                .font(.studioBodyStrong)
                .lineLimit(1)
                .truncationMode(.middle)
        }
    }

    private var actions: some View {
        HStack(spacing: 4) {
            if entry.isSaved {
                Menu {
                    savedActions
                } label: {
                    Image(systemName: "ellipsis")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(.secondary)
                        .frame(width: 28, height: 28)
                        .contentShape(Rectangle())
                }
                .accessibilityLabel("Actions for \(entry.name)")
                .menuStyle(.borderlessButton)
                .menuIndicator(.hidden)
                .fixedSize()
            }

            if !isMissing {
                Button(action: onAdd) {
                    Image(systemName: "plus")
                        .font(.system(size: 10.5, weight: .bold))
                        .foregroundStyle(canAddToProject ? Color.white : Color.secondary)
                        .frame(width: 28, height: 28)
                        .background {
                            RoundedRectangle(cornerRadius: 6, style: .continuous)
                                .fill(
                                    canAddToProject
                                        ? Color.yapperOrange.opacity(isHovering ? 1 : 0.75)
                                        : Color.studioFaintFill
                                )
                        }
                }
                .buttonStyle(.borderless)
                .accessibilityLabel("Add \(entry.name) to timeline")
                .clickableCursor()
                .disabled(!canAddToProject)
                .help(
                    canAddToProject
                        ? "Add \(entry.name) at the playhead"
                        : "Open a project in the editor first"
                )
            } else {
                Button("Remove", action: onDelete)
                    .buttonStyle(EditorGhostButtonStyle())
            }
        }
    }

    @ViewBuilder
    private var savedActions: some View {
        Button("Rename") { isRenaming = true }
        Menu("Move to") {
            ForEach(SavedAudioKind.allCases) { kind in
                Button(kind.title) { onSetKind(kind) }
                    .disabled(kind == entry.saved?.kind)
            }
        }
        Divider()
        Button("Show in Finder") {
            guard let item = entry.saved else { return }
            NSWorkspace.shared.activateFileViewerSelecting([AudioLibraryFolder.url(for: item)])
        }
        .disabled(isMissing)
        Button("Delete from library", role: .destructive, action: onDelete)
    }
}
