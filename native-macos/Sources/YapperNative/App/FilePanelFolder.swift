import AppKit

/// Where an open or save panel starts for one kind of file: the folder chosen
/// in Storage, the default, or for exports with nothing chosen, wherever the
/// last one went. A chosen folder that isn't there says so in the panel
/// instead of the panel opening somewhere at random.
@MainActor
enum FilePanelFolder {
    enum Start: Equatable {
        case folder(URL)
        case lastUsed
        case unavailable(String)
    }

    nonisolated static func start(for kind: StorageKind, folders: StorageFolders = .standard) -> Start {
        guard let chosen = folders.chosen(kind) else {
            return kind.usesLastFolderByDefault ? .lastUsed : .folder(folders.defaultFolder(for: kind))
        }
        let availability = StorageAvailability.check(chosen, isDefault: false)
        guard let problem = StorageWarningCopy.problem(kind: kind, folder: chosen, availability: availability) else {
            return .folder(chosen)
        }
        return .unavailable(problem)
    }

    static func pointFilePanel(_ panel: NSSavePanel, at kind: StorageKind, folders: StorageFolders = .standard) {
        switch start(for: kind, folders: folders) {
        case .folder(let folder):
            panel.directoryURL = folder
        case .lastUsed:
            break
        case .unavailable(let problem):
            panel.message = [problem, panel.message].filter { !$0.isEmpty }.joined(separator: "\n")
        }
    }
}
