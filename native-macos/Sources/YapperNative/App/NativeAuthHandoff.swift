import AppKit
import AuthenticationServices
import Foundation

/// Signing in through a private system authentication session.
///
/// Credentials and Google never touch the app's web view. Clerk signs the
/// person in independently of their regular browser account, and a short-lived
/// one-time ticket comes back through the
/// `yapper-studio://auth/callback` scheme to hand that identity over.
///
/// This owns both ends: the `state` that ties a callback to the attempt that
/// asked for it, and the callback itself, kept in memory when nothing is
/// listening yet so switching pages mid-login cannot lose it.
@MainActor
final class NativeAuthHandoff: NSObject, ObservableObject, ASWebAuthenticationPresentationContextProviding {
    static let shared = NativeAuthHandoff()

    /// True from opening the browser until a callback comes back.
    @Published private(set) var isWaitingInBrowser = false

    /// The ticket that came back, for whoever can redeem it.
    private var pendingCallback: URL?
    private var observers: [UUID: (URL) -> Void] = [:]
    private static let stateKey = "yapperNativeAuthenticationState"
    private var authenticationSession: ASWebAuthenticationSession?
    private var presentationWindow: NSWindow?

    private override init() { super.init() }

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
        // Repeated clicks must not replace an attempt whose callback is pending.
        guard !isWaitingInBrowser else { return true }
        guard let window = NSApp.keyWindow ?? NSApp.mainWindow else { return false }
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
        pendingCallback = nil
        presentationWindow = window
        let session = Self.makeAuthenticationSession(url: url) { [weak self] callback, _ in
            Task { @MainActor in
                guard let self, self.expectedState == state else { return }
                self.authenticationSession = nil
                self.presentationWindow = nil
                guard let callback,
                      Self.ticket(in: callback, expecting: state) != nil else {
                    self.clearState()
                    return
                }
                self.receive(callback)
            }
        }
        session.presentationContextProvider = self
        authenticationSession = session
        // Never fall back to opening the regular browser: that would silently
        // reuse its account (and changing it could sign that browser out).
        guard session.start() else {
            clearState()
            return false
        }
        return true
    }

    static func makeAuthenticationSession(
        url: URL,
        completion: @escaping ASWebAuthenticationSession.CompletionHandler
    ) -> ASWebAuthenticationSession {
        let session = ASWebAuthenticationSession(
            url: url,
            callbackURLScheme: "yapper-studio",
            completionHandler: completion
        )
        session.prefersEphemeralWebBrowserSession = true
        return session
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        presentationWindow ?? NSApp.keyWindow ?? NSApp.mainWindow ?? ASPresentationAnchor()
    }

    func clearState() {
        UserDefaults.standard.removeObject(forKey: Self.stateKey)
        isWaitingInBrowser = false
        pendingCallback = nil
        let session = authenticationSession
        authenticationSession = nil
        presentationWindow = nil
        session?.cancel()
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
