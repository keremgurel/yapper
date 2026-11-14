import Darwin
import Foundation

/// Forces writes all the way onto the drive.
///
/// `fsync` alone leaves them in the drive's own cache, and a USB stick pulled
/// without ejecting loses that cache. `F_FULLFSYNC` asks the drive to empty
/// it. File systems that don't support it get a plain `fsync`.
enum DiskFlush {
    static func flush(_ url: URL) throws {
        let descriptor = open(url.path, O_RDONLY)
        guard descriptor >= 0 else { throw Self.error() }
        defer { close(descriptor) }
        if fcntl(descriptor, F_FULLFSYNC) == 0 { return }
        guard fsync(descriptor) == 0 else { throw Self.error() }
    }

    /// Every file and folder under `root`, children before the folders that
    /// hold them, then `root` itself.
    static func flushTree(_ root: URL) throws {
        let keys: [URLResourceKey] = [.isSymbolicLinkKey]
        var items: [URL] = []
        if let walker = FileManager.default.enumerator(at: root, includingPropertiesForKeys: keys) {
            for case let item as URL in walker {
                if (try? item.resourceValues(forKeys: Set(keys)).isSymbolicLink) == true { continue }
                items.append(item)
            }
        }
        for item in items.reversed() { try flush(item) }
        try flush(root)
    }

    private static func error() -> POSIXError {
        POSIXError(POSIXErrorCode(rawValue: errno) ?? .EIO)
    }
}
