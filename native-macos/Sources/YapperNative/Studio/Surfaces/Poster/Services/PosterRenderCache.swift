import Foundation

/// Poster's rendered masters: one folder per project, one `<revision>.mp4` per
/// saved edit. All of it is a cache that Poster renders again on demand.
enum PosterRenderCache {
    static var root: URL {
        ProjectStore.directory.appending(path: "Poster renders", directoryHint: .isDirectory)
    }

    static func folder(for projectID: UUID) -> URL {
        root.appending(path: projectID.uuidString, directoryHint: .isDirectory)
    }

    /// Deletes every render in `folder` except the kept revisions. An export
    /// stages beside its destination as `.<revision>.yapper-export-<id>.mp4`,
    /// so a staged file counts as its revision and survives while it is kept.
    static func removeRenders(in folder: URL, except kept: Set<String>) {
        let files = (try? FileManager.default.contentsOfDirectory(at: folder, includingPropertiesForKeys: nil)) ?? []
        for file in files where file.pathExtension == "mp4" && !kept.contains(revision(of: file)) {
            try? FileManager.default.removeItem(at: file)
        }
    }

    /// Deletes the folders of projects that are not in `projectIDs`.
    static func removeFolders(in directory: URL, except projectIDs: Set<UUID>) {
        let folders = (try? FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil, options: .skipsHiddenFiles)) ?? []
        for folder in folders {
            guard let id = UUID(uuidString: folder.lastPathComponent), !projectIDs.contains(id) else { continue }
            try? FileManager.default.removeItem(at: folder)
        }
    }

    private static func revision(of file: URL) -> String {
        let name = file.lastPathComponent
        return String((name.hasPrefix(".") ? name.dropFirst() : Substring(name)).prefix { $0 != "." })
    }
}
