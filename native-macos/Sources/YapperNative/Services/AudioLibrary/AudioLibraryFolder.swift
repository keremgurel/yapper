import Foundation

/// Where saved audio lives on this machine.
///
/// Beside the project rather than in it: the whole point of the library is that
/// a sound outlives the edit it was first used in. It sits under the same
/// Application Support folder as the current project, which means it inherits
/// that folder's test isolation and never touches a real library from a test.
enum AudioLibraryFolder {
    static var directory: URL {
        ProjectStore.directory.appending(path: "AudioLibrary", directoryHint: .isDirectory)
    }

    static var indexURL: URL {
        directory.appending(path: "index.json")
    }

    static func fileURL(named fileName: String) -> URL {
        directory.appending(path: fileName)
    }

    static func url(for item: SavedAudio) -> URL {
        fileURL(named: item.fileName)
    }

    @discardableResult
    static func ensureExists() -> URL {
        let directory = directory
        try? FileManager.default.createDirectory(
            at: directory,
            withIntermediateDirectories: true
        )
        return directory
    }
}
