import AppKit

/// Web pages the Storage tab sends the creator to in their browser.
enum StorageLinks {
    static let pricing = "pricing"
    static let history = "history"
    static let library = "studio/library"

    static func open(_ path: String) {
        NSWorkspace.shared.open(StudioJSONClient.url(path))
    }
}
