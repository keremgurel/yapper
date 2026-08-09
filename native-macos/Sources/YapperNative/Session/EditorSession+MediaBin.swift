import Foundation
import UniformTypeIdentifiers

/// The media bin: what is picked in it, and what can be done to several things
/// at once.
@MainActor
extension EditorSession {
    var mediaOrder: [UUID] { project.media.map(\.id) }

    func isMediaSelected(_ id: UUID) -> Bool { mediaSelection.contains(id) }

    func clickMedia(_ id: UUID, modifier: MediaSelection.Modifier) {
        mediaSelection = mediaSelection.clicking(id, modifier: modifier, in: mediaOrder)
    }

    func selectAllMedia() {
        mediaSelection = mediaSelection.selecting(mediaOrder)
    }

    func clearMediaSelection() {
        mediaSelection = .empty
    }

    /// Removes everything picked, in one edit.
    func deleteSelectedMedia() async {
        await deleteImportedMedia(mediaOrder.filter { mediaSelection.contains($0) })
    }

    /// Lays everything picked onto the main track, in the order it sits in the
    /// bin.
    func appendSelectedMediaToTimeline() async {
        let wanted = project.media.filter { mediaSelection.contains($0.id) && !$0.isImage }
        guard !wanted.isEmpty else { return }
        for media in wanted {
            await appendMediaToTimeline(media.id)
        }
    }

    /// The files a drop is offering that this editor can actually open.
    ///
    /// A Finder drag carries anything, including folders and text clippings.
    /// Everything that is not a movie or an image is dropped here rather than
    /// failing one at a time inside the importer.
    nonisolated static func importableURLs(_ urls: [URL]) -> [URL] {
        urls.filter { url in
            guard
                let type = try? url.resourceValues(forKeys: [.contentTypeKey]).contentType
            else {
                // No type to read: fall back to the extension, which is enough
                // for the ordinary case of a file on a volume that has not been
                // indexed.
                return ["mp4", "mov", "m4v", "png", "jpg", "jpeg", "heic", "gif", "webp"]
                    .contains(url.pathExtension.lowercased())
            }
            return type.conforms(to: .movie) || type.conforms(to: .image)
        }
    }

    /// Imports what a drop was carrying, saying so when it was carrying nothing
    /// this editor can open.
    func importDropped(_ urls: [URL]) async {
        let usable = Self.importableURLs(urls)
        guard !usable.isEmpty else {
            if !urls.isEmpty {
                setStatus("That is not a video or an image this editor can open")
            }
            return
        }
        await importMedia(usable)
    }
}
