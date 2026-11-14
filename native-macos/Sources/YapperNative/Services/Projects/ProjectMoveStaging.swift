import Foundation

/// The hidden `.moving-<id>.yapperproj` copies a move writes before renaming
/// them into place.
///
/// A move cut short by a quit, a crash or a pulled drive leaves one behind,
/// and it can be many gigabytes. They are swept from the destination before
/// and after each move, and at launch from the projects folder and from
/// wherever the last move was heading if it couldn't be swept then.
enum ProjectMoveStaging {
    static let prefix = ".moving-"
    static let destinationKey = "storageFolder.movingInto"

    static func url(in folder: URL) -> URL {
        folder.appending(path: "\(prefix)\(UUID().uuidString).\(ProjectPackage.pathExtension)", directoryHint: .isDirectory)
    }

    static func isStaging(_ url: URL) -> Bool {
        url.lastPathComponent.hasPrefix(prefix) && url.pathExtension == ProjectPackage.pathExtension
    }

    /// Removes every staging copy directly inside `folder`. Returns how many.
    @discardableResult
    static func sweep(in folder: URL) -> Int {
        let items = (try? FileManager.default.contentsOfDirectory(at: folder, includingPropertiesForKeys: nil)) ?? []
        var removed = 0
        for item in items where isStaging(item) {
            if (try? FileManager.default.removeItem(at: item)) != nil { removed += 1 }
        }
        return removed
    }

    /// Written when a move starts and cleared when it ends, so a launch after
    /// an interrupted move knows where to look.
    static func noteMoving(into folder: URL?, preferences: any StoragePreferences) {
        preferences.setPath(folder?.standardizedFileURL.path, for: destinationKey)
    }

    /// Ends a move, or picks one up at launch: sweeps the folder it was
    /// heading to and forgets it. A folder that can't be reached, because its
    /// drive was pulled mid-copy, stays noted so the copy stranded on it is
    /// swept at a launch that finds the drive back.
    static func finishMoving(into folder: URL, preferences: any StoragePreferences) {
        var isDirectory: ObjCBool = false
        guard FileManager.default.fileExists(atPath: folder.path, isDirectory: &isDirectory), isDirectory.boolValue else { return }
        sweep(in: folder)
        noteMoving(into: nil, preferences: preferences)
    }

    /// The launch sweep.
    static func sweepAfterLaunch(folders: StorageFolders) {
        if folders.availability(of: .editorProjects) == .available {
            sweep(in: folders.folder(for: .editorProjects))
        }
        if let path = folders.preferences.path(for: destinationKey) {
            finishMoving(into: URL(filePath: path, directoryHint: .isDirectory), preferences: folders.preferences)
        }
    }
}
