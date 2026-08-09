import Foundation
import UniformTypeIdentifiers

/// The files behind a Finder drag.
///
/// A Finder drag carries each file's URL as data rather than as a string, and
/// several arrive at once, so each is read on its own and whatever fails is
/// simply not part of the drop. Shared by every surface that accepts a drag
/// from outside the app, because getting this wrong looks like a drop that did
/// nothing.
enum DroppedFiles {
    /// One at a time, in the order they were dragged: a drop is a handful of
    /// files and reading a URL out of one is nothing, so there is no race worth
    /// arranging for, and the order is worth keeping.
    @MainActor
    static func urls(from providers: [NSItemProvider]) async -> [URL] {
        var urls: [URL] = []
        for provider in providers {
            if let url = await url(from: provider) { urls.append(url) }
        }
        return urls
    }

    @MainActor
    static func url(from provider: NSItemProvider) async -> URL? {
        await withCheckedContinuation { continuation in
            _ = provider.loadDataRepresentation(
                forTypeIdentifier: UTType.fileURL.identifier
            ) { data, _ in
                guard let data, let url = URL(dataRepresentation: data, relativeTo: nil) else {
                    continuation.resume(returning: nil)
                    return
                }
                continuation.resume(returning: url)
            }
        }
    }
}
