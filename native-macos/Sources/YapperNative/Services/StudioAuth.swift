import AppKit
import Foundation

/// Whether anybody is signed in.
///
/// Clerk is asked, not guessed at. The first version read the cookie jar for a
/// `__session` cookie on ypr.app, which is a guess about a shape that is
/// Clerk's to change and is split across two domains; it came back false for a
/// signed-in account and hid the entire sidebar. The web session reports its
/// own state now (see `auth_state` in the web shell), and the cookie check is
/// only a first guess for the moment before the page has loaded.
@MainActor
final class StudioAuth: ObservableObject {
    static let shared = StudioAuth()

    /// nil until the first look, so the window does not flash a sign-in screen
    /// at somebody who is already signed in.
    @Published private(set) var isSignedIn: Bool?

    /// Set once the web session has spoken for itself. From then on the cookie
    /// guess is ignored: Clerk knows, and it is right.
    private var reportedByWeb = false
    private var watcher: Task<Void, Never>?

    /// What the web session says about itself.
    func report(signedIn: Bool) {
        reportedByWeb = true
        isSignedIn = signedIn
        if signedIn { stopWatching() }
    }

    func refresh() async {
        guard !reportedByWeb else { return }
        let hasCookie = await YapperAPI.hasSession()
        // Only ever used to say "signed in" early. Saying "signed out" from a
        // cookie that might simply be named something else is what tore the
        // chrome off a working session.
        if hasCookie { isSignedIn = true } else if isSignedIn == nil { isSignedIn = false }
    }

    /// After a sign-out, the web view's own report is stale by definition.
    func forgetWebReport() {
        reportedByWeb = false
    }

    /// Watches while signed out, and stops as soon as somebody is in.
    ///
    /// The browser half of sign-in finishes outside the app, and the cookie
    /// lands without anything on this side being called. Polling only in the
    /// signed-out state costs a cookie read every couple of seconds on a screen
    /// that is doing nothing else.
    func startWatching() {
        guard watcher == nil else { return }
        watcher = Task { [weak self] in
            while !Task.isCancelled {
                await self?.refresh()
                if self?.isSignedIn == true {
                    self?.watcher = nil
                    return
                }
                try? await Task.sleep(for: .seconds(2))
            }
        }
    }

    func stopWatching() {
        watcher?.cancel()
        watcher = nil
    }
}
