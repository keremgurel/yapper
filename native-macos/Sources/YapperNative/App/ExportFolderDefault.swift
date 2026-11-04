import AppKit

/// Where the export window opens: the exports folder chosen in Storage, or,
/// with none chosen, wherever the last export went. A chosen folder that
/// isn't there says so in the window instead of opening somewhere at random.
@MainActor
enum ExportFolderDefault {
    static func pointExportPanel(_ panel: NSSavePanel, folders: StorageFolders = .standard) {
        guard let folder = folders.chosen(.exports) else { return }
        let availability = StorageAvailability.check(folder, isDefault: false)
        if availability == .available {
            panel.directoryURL = folder
        } else if let problem = StorageWarningCopy.problem(kind: .exports, folder: folder, availability: availability) {
            panel.message = [problem, panel.message].filter { !$0.isEmpty }.joined(separator: "\n")
        }
    }
}
