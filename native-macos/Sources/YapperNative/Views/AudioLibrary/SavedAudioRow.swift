import SwiftUI

/// One saved sound.
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

    @State private var isHovering = false
    @State private var isRenaming = false
    @State private var draftName = ""
    @FocusState private var nameFocused: Bool

    var body: some View {
        HStack(spacing: 10) {
            playButton

            VStack(alignment: .leading, spacing: 2) {
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
                Text(subtitle)
                    .font(.studioCaption)
                    .foregroundStyle(isMissing ? Color.studioDanger : .secondary)
            }

            Spacer(minLength: 8)

            if isMissing {
                Button("Remove", action: onDelete)
                    .buttonStyle(EditorGhostButtonStyle())
            } else {
                Button("Add to project", action: onAdd)
                    .buttonStyle(EditorSecondaryButtonStyle())
                    .disabled(!canAddToProject)
                    .help(
                        canAddToProject
                            ? "Place this at the playhead"
                            : "Open a project in the editor first"
                    )
                    .opacity(isHovering || isPlaying ? 1 : 0.55)
            }

            menu
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 9)
        .background {
            RoundedRectangle(cornerRadius: 9, style: .continuous)
                .fill(isHovering ? Color.studioFaintFill : Color.raisedBackground)
                .overlay {
                    RoundedRectangle(cornerRadius: 9, style: .continuous)
                        .strokeBorder(
                            isPlaying ? Color.yapperOrange.opacity(0.7) : Color.studioLine,
                            lineWidth: 1
                        )
                }
        }
        .onHover { isHovering = $0 }
        .animation(.easeOut(duration: 0.12), value: isHovering)
        .onChange(of: isRenaming) { _, renaming in
            if renaming {
                draftName = item.name
                nameFocused = true
            } else {
                nameFocused = false
            }
        }
        .contextMenu {
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
    }

    private var subtitle: String {
        if isMissing { return "File missing. Import it again or remove it." }
        return "\(item.kind.itemTitle) · \(SavedAudioRow.length(item.duration))"
    }

    private var playButton: some View {
        Button(action: onToggle) {
            Image(systemName: isPlaying ? "stop.fill" : "play.fill")
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(isPlaying ? Color.white : Color.primary)
                .frame(width: 28, height: 28)
                .background {
                    Circle().fill(isPlaying ? Color.yapperOrange : Color.studioRaisedChip)
                }
        }
        .buttonStyle(.studioPlain)
        .clickableCursor()
        .disabled(isMissing)
        .help(isPlaying ? "Stop" : "Play")
    }

    private var menu: some View {
        Menu {
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

    /// Minutes and seconds, because a music bed measured in seconds tells the
    /// creator nothing about whether it covers the edit.
    static func length(_ seconds: Double) -> String {
        let whole = Int(seconds.rounded())
        if whole < 60 { return String(format: "%.1fs", max(0, seconds)) }
        return String(format: "%d:%02d", whole / 60, whole % 60)
    }
}
