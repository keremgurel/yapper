import AppKit
import SwiftUI

/// One kind of file: where it goes, the disk that folder is on, and the
/// controls to change it. A folder that can't be used says why, in place.
struct StorageFolderRow: View {
    let kind: StorageKind
    let session: EditorSession
    @ObservedObject var monitor: StorageMonitor
    @ObservedObject var move: ProjectFolderMove
    @State private var volume: StorageVolume?

    private var folders: StorageFolders { .standard }
    private var folder: URL { folders.folder(for: kind) }
    private var isChosen: Bool { folders.chosen(kind) != nil }
    private var availability: StorageAvailability { monitor.status(of: kind) }
    private var opensLastFolder: Bool { kind.usesLastFolderByDefault && !isChosen }

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: kind.systemImage)
                .font(.system(size: 15))
                .foregroundStyle(.secondary)
                .frame(width: 22, height: 20)
            VStack(alignment: .leading, spacing: 5) {
                HStack(spacing: 8) {
                    Text(kind.title).font(.system(size: 13, weight: .semibold))
                    chip
                }
                Text(kind.detail).font(.system(size: 12)).foregroundStyle(.secondary)
                location
                StorageFolderNotes(kind: kind, folder: folder, availability: availability, volume: volume, move: move)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            actions
        }
        .padding(.vertical, 14)
        .task(id: "\(monitor.generation)|\(folder.path)") {
            let folder = folder
            volume = await Task.detached(priority: .utility) { StorageVolume.of(folder) }.value
        }
    }

    @ViewBuilder
    private var chip: some View {
        switch availability {
        case .driveDisconnected: NativeChip(text: "Not connected", tone: .red)
        case .folderMissing: NativeChip(text: "Folder missing", tone: .red)
        case .available:
            if !opensLastFolder, let volume {
                NativeChip(text: volume.freeBytes.map { "\(volume.name) · \(StorageFormat.bytes(Double($0))) free" } ?? volume.name)
            }
        }
    }

    private var location: some View {
        HStack(spacing: 5) {
            Image(systemName: "folder").font(.system(size: 11))
            Text(opensLastFolder ? "Opens the last folder you exported to" : (folder.path as NSString).abbreviatingWithTildeInPath)
                .font(.system(size: 12, design: opensLastFolder ? .default : .monospaced))
                .lineLimit(1)
                .truncationMode(.middle)
                .textSelection(.enabled)
        }
        .foregroundStyle(.secondary)
        .help(folder.path)
    }

    private var actions: some View {
        HStack(spacing: 6) {
            if isChosen {
                Button("Use default") { StorageFolderPanels.useDefaultFolder(kind, session: session) }
                    .buttonStyle(EditorGhostButtonStyle())
                    .help(kind.usesLastFolderByDefault
                        ? "Open the last folder you exported to"
                        : "Go back to \((folders.defaultFolder(for: kind).path as NSString).abbreviatingWithTildeInPath)")
            }
            if !opensLastFolder {
                Button("Show in Finder") {
                    if let url = try? folders.usableFolder(for: kind) { NSWorkspace.shared.open(url) }
                }
                .buttonStyle(EditorGhostButtonStyle())
                .disabled(availability != .available)
            }
            Button(opensLastFolder ? "Choose…" : "Change…") { StorageFolderPanels.chooseFolder(kind, session: session) }
                .buttonStyle(EditorSecondaryButtonStyle(size: .small))
        }
        .disabled(move.isRunning)
    }
}

/// What a row has to say below its path: why the folder can't be used, a
/// format note for projects, or how a move is going.
private struct StorageFolderNotes: View {
    let kind: StorageKind
    let folder: URL
    let availability: StorageAvailability
    let volume: StorageVolume?
    @ObservedObject var move: ProjectFolderMove

    var body: some View {
        if let problem = StorageWarningCopy.problem(kind: kind, folder: folder, availability: availability, inStorage: true) {
            note(problem).foregroundStyle(Color.studioDanger)
        } else if kind == .editorProjects, volume?.supportsCloning == false {
            note("This drive’s format can’t share space between copies, so every import is a full copy.")
                .foregroundStyle(.secondary)
        }
        if kind == .editorProjects, let progress = move.progress {
            HStack(spacing: 10) {
                ProgressView(value: Double(progress.done), total: Double(max(progress.total, 1)))
                    .frame(width: 140)
                Text("Moving “\(progress.name)”, \(progress.done + 1) of \(progress.total)…")
                    .font(.system(size: 12)).foregroundStyle(.secondary)
            }
            .padding(.top, 2)
        } else if kind == .editorProjects, let outcome = move.outcome {
            note(outcome).foregroundStyle(.secondary)
        }
    }

    private func note(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 12))
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: 560, alignment: .leading)
    }
}
