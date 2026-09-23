import AppKit
import UniformTypeIdentifiers

/// Download: copies the take to wherever the creator picks.
enum RecorderDownload {
    /// Returns a message when the copy failed, nil when it worked or the
    /// creator cancelled.
    @MainActor
    static func save(_ take: RecorderTake) -> String? {
        let panel = NSSavePanel()
        panel.title = "Download take"
        panel.prompt = "Save"
        panel.allowedContentTypes = [take.fileExtension == "mp4" ? .mpeg4Movie : .quickTimeMovie]
        panel.nameFieldStringValue = take.suggestedFileName
        panel.canCreateDirectories = true
        guard panel.runModal() == .OK, let destination = panel.url else { return nil }
        do {
            let manager = FileManager.default
            if manager.fileExists(atPath: destination.path) { try manager.removeItem(at: destination) }
            try manager.copyItem(at: take.url, to: destination)
            return nil
        } catch {
            return "The take couldn't be written there. Pick another folder and try again."
        }
    }
}
