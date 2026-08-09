import SwiftUI

/// One saved sound of the creator's own.
///
/// Audition, name, place, reshelve, delete. Nothing else belongs on a row:
/// trimming and volume are the timeline's job, and a library that tried to be
/// an editor would be worse at both.
struct SavedAudioRow: View {
    let item: SavedAudio
    let isPlaying: Bool
    let isMissing: Bool
    /// False when no project is open, or the one that is has nothing to put a
    /// sound against.
    let canAddToProject: Bool
    let onToggle: () -> Void
    let onAdd: () -> Void
    let onRename: (String) -> Void
    let onSetKind: (SavedAudioKind) -> Void
    let onDelete: () -> Void

    @State private var isRenaming = false
    @State private var draftName = ""
    @FocusState private var nameFocused: Bool

    var body: some View {
        AudioLibraryRowShell(
            subtitle: subtitle,
            subtitleTint: isMissing ? Color.studioDanger : .secondary,
            isPlaying: isPlaying,
            playDisabled: isMissing,
            onToggle: onToggle
        ) {
            if isRenaming {
                TextField("Name", text: $draftName)
                    .textFieldStyle(.plain)
                    .font(.studioBodyStrong)
                    .focused($nameFocused)
                    .onSubmit(commitRename)
                    .onExitCommand { isRenaming = false }
            } else {
                Text(item.name)
                    .font(.studioBodyStrong)
                    .lineLimit(1)
                    .truncationMode(.middle)
            }
        } trailing: { isHovering in
            HStack(spacing: 6) {
                if isMissing {
                    Button("Remove", action: onDelete)
                        .buttonStyle(EditorGhostButtonStyle())
                } else {
                    AddToProjectButton(
                        canAdd: canAddToProject,
                        prominent: isHovering || isPlaying,
                        action: onAdd
                    )
                }
                menu
            }
        }
        .onChange(of: isRenaming) { _, renaming in
            if renaming {
                draftName = item.name
                nameFocused = true
            } else {
                nameFocused = false
            }
        }
        .contextMenu { actions }
    }

    private var subtitle: String {
        if isMissing { return "File missing. Import it again or remove it." }
        return "\(item.kind.itemTitle) · \(AudioLength.short(item.duration))"
    }

    @ViewBuilder
    private var actions: some View {
        Button("Rename") { isRenaming = true }
        Menu("Move to") {
            ForEach(SavedAudioKind.allCases) { kind in
                Button(kind.title) { onSetKind(kind) }
                    .disabled(kind == item.kind)
            }
        }
        Divider()
        Button("Show in Finder", action: revealInFinder)
            .disabled(isMissing)
        Button("Delete from library", role: .destructive, action: onDelete)
    }

    private var menu: some View {
        Menu {
            actions
        } label: {
            Image(systemName: "ellipsis")
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(.secondary)
                .frame(width: 24, height: 24)
                .contentShape(Rectangle())
        }
        .menuStyle(.borderlessButton)
        .menuIndicator(.hidden)
        .fixedSize()
    }

    private func commitRename() {
        isRenaming = false
        onRename(draftName)
    }

    private func revealInFinder() {
        NSWorkspace.shared.activateFileViewerSelecting([AudioLibraryFolder.url(for: item)])
    }
}

/// The one action every row on the page has, said the same way on all of them.
struct AddToProjectButton: View {
    let canAdd: Bool
    /// Full strength under the pointer, dimmed otherwise: a page of rows each
    /// shouting the same button is a page you cannot read.
    let prominent: Bool
    let action: () -> Void

    var body: some View {
        Button("Add to project", action: action)
            .buttonStyle(EditorSecondaryButtonStyle())
            .disabled(!canAdd)
            .help(canAdd ? "Place this at the playhead" : "Open a project in the editor first")
            .opacity(prominent ? 1 : 0.55)
    }
}
