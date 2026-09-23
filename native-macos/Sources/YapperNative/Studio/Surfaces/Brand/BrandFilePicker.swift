import AppKit
import UniformTypeIdentifiers

/// The open panel for choosing a logo file.
@MainActor
enum BrandFilePicker {
    static func chooseLogo() -> URL? {
        let panel = NSOpenPanel()
        panel.title = "Upload logo"
        panel.prompt = "Upload"
        panel.message = "PNG, JPG, WebP, or SVG, up to 5 MB"
        panel.allowedContentTypes = BrandLogoUploader.acceptedTypes
        panel.allowsMultipleSelection = false
        panel.canChooseDirectories = false
        return panel.runModal() == .OK ? panel.url : nil
    }
}
