import AppKit

/// Choosing a folder for one kind of file, and for editor projects, asking
/// whether the ones already saved should come along.
@MainActor
enum StorageFolderPanels {
    static func chooseFolder(_ kind: StorageKind, session: EditorSession, folders: StorageFolders = .standard) {
        let panel = NSOpenPanel()
        panel.title = "Choose a folder for \(kind.phrase)"
        panel.message = kind.detail
        panel.prompt = "Use this folder"
        panel.canChooseDirectories = true
        panel.canChooseFiles = false
        panel.canCreateDirectories = true
        panel.allowsMultipleSelection = false
        panel.treatsFilePackagesAsDirectories = false
        if folders.availability(of: kind) == .available { panel.directoryURL = folders.folder(for: kind) }
        guard panel.runModal() == .OK, let url = panel.url else { return }
        if let problem = StorageFolderCheck.problem(with: url) {
            showAlert(title: "Choose another folder", message: problem)
            return
        }
        Task { await applyFolderChoice(url, for: kind, session: session, folders: folders) }
    }

    static func useDefaultFolder(_ kind: StorageKind, session: EditorSession, folders: StorageFolders = .standard) {
        Task { await applyFolderChoice(nil, for: kind, session: session, folders: folders) }
    }

    /// `folder` nil means the default.
    private static func applyFolderChoice(_ folder: URL?, for kind: StorageKind, session: EditorSession, folders: StorageFolders) async {
        let target = folder ?? folders.defaultFolder(for: kind)
        let sameFolder = folders.isCurrentFolder(target, for: kind)
        guard !sameFolder || (folder == nil) != (folders.chosen(kind) == nil) else { return }
        NativeAnalytics.shared.capture("native_storage_folder_changed", [
            "kind": kind.rawValue,
            "custom": folder != nil,
            "external": StorageVolume.of(target)?.isInternal == false,
        ])
        // The folder already in use, by another path or picked by hand while
        // it was the default: remember the choice and move nothing.
        guard kind == .editorProjects, !sameFolder else {
            if let folder { folders.choose(folder, for: kind) } else { folders.useDefault(for: kind) }
            return
        }
        let packages = (try? await ProjectLibrary.shared.packages()) ?? []
        guard !packages.isEmpty else {
            if let folder { folders.choose(folder, for: kind) } else { folders.useDefault(for: kind) }
            return
        }
        if let blocker = await ProjectFolderMove.shared.blocker(for: session, moving: packages) {
            showAlert(title: "Projects can’t move yet", message: blocker)
            return
        }
        switch await askToMove(packages, to: target, from: folders.folder(for: kind)) {
        case .move:
            await ProjectFolderMove.shared.moveProjects(choosing: folder, moving: packages, session: session, folders: folders)
        case .leave:
            if let folder { folders.choose(folder, for: kind) } else { folders.useDefault(for: kind) }
        case .cancel:
            return
        }
    }

    private enum MoveChoice { case move, leave, cancel }

    private static func askToMove(_ packages: [ProjectPackage], to target: URL, from current: URL) async -> MoveChoice {
        let bytes = await Task.detached(priority: .userInitiated) {
            packages.reduce(Int64(0)) { $0 + ProjectDiskUsage.bytes(in: $1.url) }
        }.value
        let count = packages.count == 1 ? "your project" : "your \(packages.count) projects"
        let alert = NSAlert()
        alert.messageText = "Move \(count) to “\(target.lastPathComponent)”?"
        let sameDisk = StorageVolume.sameVolume(current, target)
        alert.informativeText = sameDisk
            ? "They take \(ProjectDiskUsage.label(bytes)). They move to the new folder right away."
            : "They take \(ProjectDiskUsage.label(bytes)). Yapper copies each one, checks the copy, then puts the original in the Trash. Leave them and they stay in “\(current.lastPathComponent)”, where Open… still finds them."
        alert.addButton(withTitle: "Move projects")
        alert.addButton(withTitle: "Leave them")
        alert.addButton(withTitle: "Cancel")
        switch alert.runModal() {
        case .alertFirstButtonReturn: return .move
        case .alertSecondButtonReturn: return .leave
        default: return .cancel
        }
    }

    static func showAlert(title: String, message: String) {
        let alert = NSAlert()
        alert.messageText = title
        alert.informativeText = message
        alert.addButton(withTitle: "OK")
        alert.runModal()
    }
}
