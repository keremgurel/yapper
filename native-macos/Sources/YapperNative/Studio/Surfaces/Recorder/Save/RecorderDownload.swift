import AppKit

/// Where a take goes once it is done. Nothing is uploaded: the take is a file
/// on this Mac, and it stays one. Both folders are the ones chosen in Storage.
enum RecorderDownload {
    /// Copies the take into the recorder downloads folder (Downloads unless
    /// another was chosen) under its timestamped name and shows it in Finder.
    /// Returns a message when the copy failed.
    @MainActor
    static func toDownloads(_ take: RecorderTake) -> String? {
        let folder: URL
        do {
            folder = try StorageFolders.standard.usableFolder(for: .recorderDownloads)
        } catch {
            return error.localizedDescription
        }
        do {
            let destination = try copy(take, into: folder)
            NSWorkspace.shared.activateFileViewerSelecting([destination])
            return nil
        } catch {
            return "The take couldn’t be saved to “\(folder.lastPathComponent)”. Check there is space, then try again."
        }
    }

    /// Where Download saves, for the button's tooltip.
    static var downloadsFolderName: String {
        StorageFolders.standard.folder(for: .recorderDownloads).lastPathComponent
    }

    /// Keeps the take in the recordings folder (Movies/Yapper Recordings unless
    /// another was chosen), where an editor project can point at it for good:
    /// the capture file lives in a temporary folder.
    static func keepForEditor(_ take: RecorderTake) throws -> URL {
        try copy(take, into: StorageFolders.standard.usableFolder(for: .editorRecordings))
    }

    private static func copy(_ take: RecorderTake, into folder: URL) throws -> URL {
        let manager = FileManager.default
        let base = (take.suggestedFileName as NSString).deletingPathExtension
        let ext = take.fileExtension
        var destination = folder.appending(path: "\(base).\(ext)")
        var suffix = 2
        while manager.fileExists(atPath: destination.path) {
            destination = folder.appending(path: "\(base) \(suffix).\(ext)")
            suffix += 1
        }
        try manager.copyItem(at: take.url, to: destination)
        return destination
    }
}
