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

    static func openAudio(for session: EditorSession) {
        let panel = NSOpenPanel()
        panel.title = "Import audio"
        panel.prompt = "Import"
        panel.allowedContentTypes = [.audio]
        panel.allowsMultipleSelection = true
        panel.canChooseDirectories = false
        guard panel.runModal() == .OK else { return }
        Task { await session.importAudio(panel.urls) }
    }

    /// Into the library rather than into the open project: the same panel, a
    /// different destination, and the reason the two are named apart.
    @MainActor
    static func openLibraryAudio(into store: AudioLibraryStore) {
        let panel = NSOpenPanel()
        panel.title = "Add to audio library"
        panel.prompt = "Add"
        panel.allowedContentTypes = [.audio]
        panel.allowsMultipleSelection = true
        panel.canChooseDirectories = false
        guard panel.runModal() == .OK else { return }
        let urls = panel.urls
        Task { await store.add(urls) }
    }
}
