import Foundation

extension Notification.Name {
    /// A storage folder was chosen or reset.
    static let storageFoldersChanged = Notification.Name("storageFoldersChanged")
}

/// Where each kind of file goes: the folder the creator chose, or the default.
///
/// A chosen folder is used exactly as chosen and is never recreated. If it
/// were, a drive that isn't plugged in would get an empty stand-in folder on
/// this Mac, and the next save would land there instead of on the drive.
struct StorageFolders: @unchecked Sendable {
    /// Read by `ProjectLibrary` before folders had a screen. Still honoured for
    /// editor projects so a folder set by hand keeps working.
    static let legacyProjectsKey = "projectsDirectoryPath"

    let preferences: any StoragePreferences
    let movies: URL
    let downloads: URL

    static var standard: StorageFolders {
        if ProjectStore.isTesting { return testing }
        let manager = FileManager.default
        let home = manager.homeDirectoryForCurrentUser
        return StorageFolders(
            preferences: DefaultsStoragePreferences(),
            movies: manager.urls(for: .moviesDirectory, in: .userDomainMask).first ?? home.appending(path: "Movies"),
            downloads: manager.urls(for: .downloadsDirectory, in: .userDomainMask).first ?? home.appending(path: "Downloads")
        )
    }

    /// Test runs never read or write the creator's folders or preferences.
    private static let testing: StorageFolders = {
        let root = FileManager.default.temporaryDirectory
            .appending(path: "YapperStorageTests-\(ProcessInfo.processInfo.processIdentifier)", directoryHint: .isDirectory)
        return StorageFolders(
            preferences: MemoryStoragePreferences(),
            movies: root.appending(path: "Movies", directoryHint: .isDirectory),
            downloads: root.appending(path: "Downloads", directoryHint: .isDirectory)
        )
    }()

    /// The folder files of this kind are written to now.
    func folder(for kind: StorageKind) -> URL {
        chosen(kind) ?? defaultFolder(for: kind)
    }

    /// The folder the creator picked, or nil while the default is in use.
    func chosen(_ kind: StorageKind) -> URL? {
        let path = preferences.path(for: kind.defaultsKey)
            ?? (kind == .editorProjects ? preferences.path(for: Self.legacyProjectsKey) : nil)
        guard let path, !path.isEmpty else { return nil }
        return URL(filePath: path, directoryHint: .isDirectory)
    }

    func defaultFolder(for kind: StorageKind) -> URL {
        switch kind {
        case .editorProjects: movies.appending(path: "Yapper Projects", directoryHint: .isDirectory)
        case .editorRecordings: movies.appending(path: "Yapper Recordings", directoryHint: .isDirectory)
        case .recorderDownloads: downloads
        case .exports: movies
        }
    }

    func choose(_ folder: URL, for kind: StorageKind) {
        preferences.setPath(folder.standardizedFileURL.path, for: kind.defaultsKey)
        if kind == .editorProjects { preferences.setPath(nil, for: Self.legacyProjectsKey) }
        NotificationCenter.default.post(name: .storageFoldersChanged, object: nil)
    }

    func useDefault(for kind: StorageKind) {
        preferences.setPath(nil, for: kind.defaultsKey)
        if kind == .editorProjects { preferences.setPath(nil, for: Self.legacyProjectsKey) }
        NotificationCenter.default.post(name: .storageFoldersChanged, object: nil)
    }

    func availability(of kind: StorageKind) -> StorageAvailability {
        StorageAvailability.check(folder(for: kind), isDefault: chosen(kind) == nil)
    }

    /// The folder, ready to write into. A default is created on first use; a
    /// chosen folder has to be there already.
    func usableFolder(for kind: StorageKind) throws -> URL {
        try usableFolder(chosen(kind), for: kind)
    }

    /// The same for a folder that isn't the setting yet: `folder`, or the
    /// default when it's nil. A move readies its destination this way and
    /// switches the setting only once projects are there.
    func usableFolder(_ folder: URL?, for kind: StorageKind) throws -> URL {
        guard let folder else {
            let folder = defaultFolder(for: kind)
            try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
            return folder
        }
        let availability = StorageAvailability.check(folder, isDefault: false)
        guard availability == .available else {
            throw StorageUnavailableError(kind: kind, folder: folder, availability: availability)
        }
        return folder
    }

    /// True when `folder` is the one already in use, reached by another path
    /// or picked by hand while it was the default.
    func isCurrentFolder(_ folder: URL, for kind: StorageKind) -> Bool {
        FolderIdentity.same(folder, self.folder(for: kind))
    }
}
