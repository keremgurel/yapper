import Foundation

/// The disk a folder is on, as the Storage page describes it.
struct StorageVolume: Equatable, Sendable {
    let name: String
    let isInternal: Bool
    let freeBytes: Int64?
    /// APFS can clone a file into a project without using more space. Other
    /// formats, exFAT on most USB sticks, make every import a full copy.
    let supportsCloning: Bool

    /// Reads the folder's disk, or its nearest existing parent's when a
    /// default folder hasn't been created yet. Nil when nothing on the path
    /// exists, as for an unplugged drive.
    static func of(_ folder: URL) -> StorageVolume? {
        guard let url = nearestExisting(folder) else { return nil }
        let keys: Set<URLResourceKey> = [
            .volumeLocalizedNameKey, .volumeIsInternalKey,
            .volumeAvailableCapacityForImportantUsageKey, .volumeAvailableCapacityKey, .volumeSupportsFileCloningKey,
        ]
        guard let values = try? url.resourceValues(forKeys: keys) else { return nil }
        // exFAT and other non-APFS drives report 0 for "important usage";
        // the plain figure is the real one there.
        let important = values.volumeAvailableCapacityForImportantUsage ?? 0
        let plain = values.volumeAvailableCapacity.map(Int64.init)
        return StorageVolume(
            name: values.volumeLocalizedName ?? "This Mac",
            isInternal: values.volumeIsInternal ?? true,
            freeBytes: important > 0 ? important : plain,
            supportsCloning: values.volumeSupportsFileCloning ?? false
        )
    }

    /// Whether two folders are on the same disk, so a move is a rename.
    static func sameVolume(_ first: URL, _ second: URL) -> Bool {
        let key: Set<URLResourceKey> = [.volumeIdentifierKey]
        guard let first = nearestExisting(first), let second = nearestExisting(second),
              let a = (try? first.resourceValues(forKeys: key))?.volumeIdentifier as? NSObject,
              let b = (try? second.resourceValues(forKeys: key))?.volumeIdentifier as? NSObject
        else { return false }
        return a.isEqual(b)
    }

    /// The path itself, or the closest parent that exists. It never climbs out
    /// of a missing drive to `/Volumes`, which is on the startup disk.
    private static func nearestExisting(_ folder: URL) -> URL? {
        var url = folder.standardizedFileURL
        while !FileManager.default.fileExists(atPath: url.path) {
            let parent = url.deletingLastPathComponent()
            guard parent.path != url.path, parent.path != StorageAvailability.volumesRoot.path else { return nil }
            url = parent
        }
        return url
    }
}
