import Foundation

/// Whether a folder can be used right now, and why not when it can't.
enum StorageAvailability: Equatable, Sendable {
    case available
    /// The folder is on a drive that isn't mounted.
    case driveDisconnected(name: String)
    /// The folder was moved, renamed or deleted.
    case folderMissing

    static let volumesRoot = URL(filePath: "/Volumes", directoryHint: .isDirectory)

    /// A default folder that doesn't exist yet is still available: it's
    /// created on first use. A chosen one has to be there.
    static func check(_ folder: URL, isDefault: Bool, volumesRoot: URL = volumesRoot) -> StorageAvailability {
        if isDirectory(folder) { return .available }
        if let drive = driveName(for: folder, volumesRoot: volumesRoot),
           !isDirectory(volumesRoot.appending(path: drive, directoryHint: .isDirectory)) {
            return .driveDisconnected(name: drive)
        }
        return isDefault ? .available : .folderMissing
    }

    /// The drive a path lives on, when it's under `/Volumes`.
    static func driveName(for url: URL, volumesRoot: URL = volumesRoot) -> String? {
        let components = url.standardizedFileURL.pathComponents
        let root = volumesRoot.standardizedFileURL.pathComponents
        guard components.count > root.count, Array(components.prefix(root.count)) == root else { return nil }
        return components[root.count]
    }

    private static func isDirectory(_ url: URL) -> Bool {
        var isDirectory: ObjCBool = false
        return FileManager.default.fileExists(atPath: url.path, isDirectory: &isDirectory) && isDirectory.boolValue
    }
}
