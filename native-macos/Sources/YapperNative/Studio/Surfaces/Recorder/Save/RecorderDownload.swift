import AppKit

/// Where a take goes once it is done. Nothing is uploaded: the take is a file
/// on this Mac, and it stays one.
enum RecorderDownload {
    /// Copies the take into Downloads under its timestamped name and shows it
    /// in Finder. Returns a message when the copy failed.
    @MainActor
    static func toDownloads(_ take: RecorderTake) -> String? {
        let folder = FileManager.default.urls(for: .downloadsDirectory, in: .userDomainMask).first
        guard let folder else { return "Your Downloads folder couldn't be found." }
        do {
            let destination = try copy(take, into: folder)
            NSWorkspace.shared.activateFileViewerSelecting([destination])
            return nil
        } catch {
            return "The take couldn't be saved to Downloads. Check there is space, then try again."
        }
    }

    /// Keeps the take in Movies/Yapper Recordings, where an editor project can
    /// point at it for good (the capture file lives in a temporary folder).
    static func keepForEditor(_ take: RecorderTake) throws -> URL {
        let movies = FileManager.default.urls(for: .moviesDirectory, in: .userDomainMask).first
            ?? FileManager.default.homeDirectoryForCurrentUser.appending(path: "Movies")
        let folder = movies.appending(path: "Yapper Recordings", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        return try copy(take, into: folder)
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
