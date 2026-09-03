import Foundation

/// The projects opened most recently, newest first, and therefore also the one
/// to reopen at launch. Paths, not bookmarks: the app is not sandboxed, and a
/// project that has been moved simply drops off the list.
enum RecentProjects {
    private static let key = "recentProjectPaths"
    private static let limit = 12

    static func all(defaults: UserDefaults = .standard) -> [URL] {
        let paths = defaults.stringArray(forKey: key) ?? []
        return paths
            .map { URL(filePath: $0) }
            .filter { FileManager.default.fileExists(atPath: $0.path) }
    }

    static var lastOpened: URL? { all().first }

    static func record(_ url: URL, defaults: UserDefaults = .standard) {
        var paths = (defaults.stringArray(forKey: key) ?? []).filter { $0 != url.path }
        paths.insert(url.path, at: 0)
        defaults.set(Array(paths.prefix(limit)), forKey: key)
    }

    static func forget(_ url: URL, defaults: UserDefaults = .standard) {
        let paths = (defaults.stringArray(forKey: key) ?? []).filter { $0 != url.path }
        defaults.set(paths, forKey: key)
    }

    /// A move or rename: the old path is gone, the new one takes its place.
    static func replace(_ old: URL, with new: URL, defaults: UserDefaults = .standard) {
        var paths = defaults.stringArray(forKey: key) ?? []
        paths = paths.map { $0 == old.path ? new.path : $0 }
        defaults.set(paths, forKey: key)
    }
}
