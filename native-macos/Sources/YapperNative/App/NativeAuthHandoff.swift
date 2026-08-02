import Foundation

/// Delivers the custom-scheme callback from the user's default browser to the
/// cloud surface that initiated sign-in. It keeps one callback in memory when
/// the web surface is temporarily unmounted, so switching pages cannot lose a
/// completed login.
@MainActor
final class NativeAuthHandoff {
    static let shared = NativeAuthHandoff()

    private var pendingCallback: URL?
    private var observers: [UUID: (URL) -> Void] = [:]

    private init() {}

    func receive(_ url: URL) {
        guard
            url.scheme == "yapper-studio",
            url.host == "auth",
            url.path == "/callback"
        else { return }

        guard !observers.isEmpty else {
            pendingCallback = url
            return
        }
        for observer in observers.values { observer(url) }
    }

    func observe(_ observer: @escaping (URL) -> Void) -> UUID {
        let id = UUID()
        observers[id] = observer
        if let pendingCallback {
            self.pendingCallback = nil
            observer(pendingCallback)
        }
        return id
    }

    func removeObserver(_ id: UUID?) {
        guard let id else { return }
        observers.removeValue(forKey: id)
    }
}
