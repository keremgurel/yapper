import Foundation

/// Removes export scratch that a crashed or killed process left in the temp
/// folder.
///
/// An export removes its own snapshot folder when it finishes, fails or is
/// cancelled. Only a process that dies mid-export (a crash, a force quit, a
/// killed test run) leaves one behind, so the app sweeps once at launch.
enum StaleExportScratchSweeper {
    static let staleAge: TimeInterval = 24 * 60 * 60

    /// Builds before the intermediate moved into the snapshot folder wrote
    /// the first pass of a two-pass export straight into the temp folder, and
    /// AVFoundation's partial `.sb-` file beside it when the process died.
    static let legacyCompositedPrefix = "yapper-composited-"

    static func sweep(
        in root: URL = FileManager.default.temporaryDirectory,
        now: Date = Date()
    ) {
        let keys: Set<URLResourceKey> = [.isDirectoryKey, .contentModificationDateKey]
        guard let entries = try? FileManager.default.contentsOfDirectory(
            at: root,
            includingPropertiesForKeys: Array(keys),
            options: [.skipsHiddenFiles]
        ) else { return }

        for entry in entries {
            let name = entry.lastPathComponent
            let isSnapshot = name.hasPrefix(ExportSourceSnapshot.directoryPrefix)
            guard isSnapshot || name.hasPrefix(legacyCompositedPrefix),
                  let values = try? entry.resourceValues(forKeys: keys),
                  let modified = values.contentModificationDate,
                  now.timeIntervalSince(modified) >= staleAge
            else { continue }

            if isSnapshot {
                guard values.isDirectory == true else { continue }
                removeUnlessInUse(entry)
            } else if values.isDirectory != true {
                try? FileManager.default.removeItem(at: entry)
            }
        }
    }

    private static func removeUnlessInUse(_ folder: URL) {
        switch ExportScratchLock.claim(folder) {
        case .inUse:
            return
        case .unmarked:
            try? FileManager.default.removeItem(at: folder)
        case let .claimed(lock):
            try? FileManager.default.removeItem(at: folder)
            lock.release()
        }
    }
}
