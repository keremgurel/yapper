import AppKit
import UniformTypeIdentifiers

@MainActor
enum ImportPanels {
    static func openMedia(for session: EditorSession) {
        let panel = NSOpenPanel()
        panel.title = "Import media"
        panel.prompt = "Import"
        panel.allowedContentTypes = [.movie, .mpeg4Movie, .quickTimeMovie, .image]
        panel.allowsMultipleSelection = true
        panel.canChooseDirectories = false
        guard panel.runModal() == .OK else { return }
        Task { await session.importMedia(panel.urls) }
    }

    static func saveExport(for session: EditorSession) {
        let panel = NSSavePanel()
        panel.title = "Export video"
        panel.prompt = "Export"
        panel.allowedContentTypes = [.mpeg4Movie]
        panel.nameFieldStringValue = "\(session.project.name)-export.mp4"
        guard panel.runModal() == .OK, let url = panel.url else { return }
        Task { await session.export(to: url) }
    }
}
