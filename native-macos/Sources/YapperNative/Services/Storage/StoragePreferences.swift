import Foundation

/// Where the chosen folders are remembered: the app's preferences, or memory
/// for tests, so a test run leaves no preference files behind.
protocol StoragePreferences: AnyObject {
    func path(for key: String) -> String?
    func setPath(_ path: String?, for key: String)
}

final class DefaultsStoragePreferences: StoragePreferences {
    private let defaults: UserDefaults

    init(_ defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    func path(for key: String) -> String? {
        defaults.string(forKey: key)
    }

    func setPath(_ path: String?, for key: String) {
        if let path { defaults.set(path, forKey: key) } else { defaults.removeObject(forKey: key) }
    }
}

final class MemoryStoragePreferences: StoragePreferences, @unchecked Sendable {
    private let lock = NSLock()
    private var values: [String: String] = [:]

    func path(for key: String) -> String? {
        lock.withLock { values[key] }
    }

    func setPath(_ path: String?, for key: String) {
        lock.withLock { values[key] = path }
    }
}
