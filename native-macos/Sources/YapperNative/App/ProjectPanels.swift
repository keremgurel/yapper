import AppKit
import UniformTypeIdentifiers

/// The panels around projects: naming one, finding one, saving a copy.
@MainActor
enum ProjectPanels {
    /// A one-line name prompt. Returns nil when cancelled or left empty.
    static func promptName(title: String, message: String, initial: String, action: String) -> String? {
        let alert = NSAlert()
        alert.messageText = title
        alert.informativeText = message
        alert.addButton(withTitle: action)
        alert.addButton(withTitle: "Cancel")
        let field = NSTextField(frame: NSRect(x: 0, y: 0, width: 280, height: 24))
        field.stringValue = initial
        field.placeholderString = "Project name"
        alert.accessoryView = field
        alert.window.initialFirstResponder = field
        field.selectText(nil)
        guard alert.runModal() == .alertFirstButtonReturn else { return nil }
        let name = field.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
        return name.isEmpty ? nil : name
    }

    static func newProject(for session: EditorSession) {
        guard let name = promptName(
            title: "New project",
            message: "Saved on this Mac in your Yapper Projects folder.",
            initial: "Untitled project",
            action: "Create"
        ) else { return }
        Task { await session.createProject(named: name) }
    }

    static func renameProject(for session: EditorSession) {
        guard let name = promptName(
            title: "Rename project",
            message: "The folder in Yapper Projects is renamed with it.",
            initial: session.project.name,
            action: "Rename"
        ) else { return }
        Task { await session.renameCurrentProject(to: name) }
    }

    static func openProject(for session: EditorSession) {
        let panel = NSOpenPanel()
        panel.title = "Open project"
        panel.prompt = "Open"
        panel.canChooseDirectories = true
        panel.canChooseFiles = true
        panel.allowsMultipleSelection = false
        panel.treatsFilePackagesAsDirectories = false
        panel.directoryURL = ProjectLibrary.defaultDirectory
        guard panel.runModal() == .OK, let url = panel.url else { return }
        guard ProjectPackage.isPackage(url) else {
            session.setStatus("Choose a .\(ProjectPackage.pathExtension) project.")
            return
        }
        Task { await session.openProject(ProjectPackage(url: url)) }
    }

    static func saveCopy(for session: EditorSession) {
        let panel = NSSavePanel()
        panel.title = "Save a copy"
        panel.prompt = "Save"
        panel.nameFieldStringValue = ProjectPackage.fileName(for: session.project.name + " copy")
        panel.directoryURL = ProjectLibrary.defaultDirectory
        panel.canCreateDirectories = true
        guard panel.runModal() == .OK, var url = panel.url else { return }
        if !ProjectPackage.isPackage(url) {
            url = url.appendingPathExtension(ProjectPackage.pathExtension)
        }
        Task { await session.saveCopy(to: url) }
    }

    static func revealInFinder(_ package: ProjectPackage) {
        NSWorkspace.shared.activateFileViewerSelecting([package.url])
    }
}
