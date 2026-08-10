import AppKit
import Foundation

/// Signing in, which happens in the creator's own browser.
///
/// Credentials and Google never touch the app's web view: it opens the default
/// browser, Clerk signs the person in there with their existing session and
/// password manager, and a short-lived one-time ticket comes back through the
/// `yapper-studio://auth/callback` scheme to hand that identity over.
///
/// This owns both ends: the `state` that ties a callback to the attempt that
/// asked for it, and the callback itself, kept in memory when nothing is
/// listening yet so switching pages mid-login cannot lose it.
@MainActor
final class NativeAuthHandoff: ObservableObject {
    static let shared = NativeAuthHandoff()

    /// True from opening the browser until a callback comes back.
    @Published private(set) var isWaitingInBrowser = false

    /// The ticket that came back, for whoever can redeem it.
    private var pendingCallback: URL?
    private var observers: [UUID: (URL) -> Void] = [:]
    private static let stateKey = "yapperNativeAuthenticationState"

    private init() {}

    /// The attempt currently in flight. Persisted, because the browser half can
    /// outlive a relaunch of the app.
    var expectedState: String? {
        UserDefaults.standard.string(forKey: Self.stateKey)
    }

    /// Opens the browser half of sign-in.
    /// - Returns: false when no browser could be opened, which is the only
    ///   failure the caller can say anything useful about.
    @discardableResult
    func begin(at baseURL: URL = URL(string: "https://ypr.app/studio/native-auth")!) -> Bool {
        let state = UUID().uuidString.lowercased()
        guard var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false) else {
            return false
        }
        var queryItems = components.queryItems ?? []
        queryItems.removeAll { $0.name == "state" }
        queryItems.append(URLQueryItem(name: "state", value: state))
        components.queryItems = queryItems
        guard let url = components.url else { return false }

        UserDefaults.standard.set(state, forKey: Self.stateKey)
        isWaitingInBrowser = true
        // NSWorkspace uses the person's configured default browser and its
        // normal cookie jar. ASWebAuthenticationSession presents a separate auth
        // sheet, which was the source of the inconsistent sign-in UX.
        guard NSWorkspace.shared.open(url) else {
            clearState()
            return false
        }
        return true
    }

    func clearState() {
        UserDefaults.standard.removeObject(forKey: Self.stateKey)
        isWaitingInBrowser = false
    }

    /// The ticket in a callback, if the callback is one we asked for.
    ///
    /// Pure, so the rules can be tested: the scheme, host and path have to be
    /// ours, the state has to match the attempt in flight, and the ticket has
    /// to be there. A callback that fails any of those is somebody else's link.
    nonisolated static func ticket(in url: URL, expecting state: String?) -> String? {
        guard
            url.scheme == "yapper-studio",
            url.host == "auth",
            url.path == "/callback",
            let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
            let ticket = components.queryItems?.first(where: { $0.name == "ticket" })?.value,
            let returned = components.queryItems?.first(where: { $0.name == "state" })?.value,
            let state,
            returned == state,
            !ticket.isEmpty
        else { return nil }
        return ticket
    }

    func receive(_ url: URL) {
        isWaitingInBrowser = false
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
