import Foundation

/// The hidden files exports are writing right now, remembered across launches.
///
/// An export renders into `.<name>.yapper-export-<id>.mp4` beside the chosen
/// file, and a caption export renders a first pass into the temporary folder.
/// Both are removed when the export ends. A force quit or a crash ends it
/// without that cleanup, and nothing else would ever find the files: they are
/// hidden, next to the creator's own work. The next launch deletes them.
///
/// Exact paths rather than a folder scan: reading Desktop or Documents at every
/// launch would ask for access the creator only gave to the file they chose.
final class StagedExportLedger: @unchecked Sendable {
    static let shared = StagedExportLedger(defaults: .standard)
    private static let key = "stagedExportFiles"

    private let defaults: UserDefaults
    private let lock = NSLock()

    init(defaults: UserDefaults) {
        self.defaults = defaults
    }

    func record(_ file: URL) {
        lock.withLock {
            var paths = defaults.stringArray(forKey: Self.key) ?? []
            if !paths.contains(file.path) { paths.append(file.path) }
            defaults.set(paths, forKey: Self.key)
        }
    }

    func forget(_ file: URL) {
        lock.withLock {
            let paths = (defaults.stringArray(forKey: Self.key) ?? []).filter { $0 != file.path }
            defaults.set(paths, forKey: Self.key)
        }
    }

    var recorded: [URL] {
        lock.withLock { (defaults.stringArray(forKey: Self.key) ?? []).map { URL(filePath: $0) } }
    }

    /// Everything recorded so far, cleared from the ledger. Call it at launch,
    /// before any export can start, so nothing in flight is in the list.
    func takeLeftovers() -> [URL] {
        lock.withLock {
            let paths = defaults.stringArray(forKey: Self.key) ?? []
            defaults.removeObject(forKey: Self.key)
            return paths.map { URL(filePath: $0) }
        }
    }

    /// Deletes files an earlier launch left behind. Returns what it removed.
    @discardableResult
    static func remove(_ leftovers: [URL], fileManager: FileManager = .default) -> [URL] {
        leftovers.filter { file in
            guard fileManager.fileExists(atPath: file.path) else { return false }
            return (try? fileManager.removeItem(at: file)) != nil
        }
    }
}
