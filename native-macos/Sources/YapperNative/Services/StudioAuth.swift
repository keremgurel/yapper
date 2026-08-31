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

    /// Whether we have waited long enough to call it: a page that never says
    /// anything, on a build too old to report, still has to reach the door.
    private var firstLook: Date?

    func refresh() async {
        guard !reportedByWeb else { return }
        if await YapperAPI.hasSession() {
            isSignedIn = true
            return
        }
        // Never says "signed out" on the cookie's word alone. The guess was
        // wrong once already and took the whole sidebar with it, and being
        // wrong in this direction throws a working session out of the app.
        // Unknown stays unknown, which the shell treats as signed in, until
        // either the page speaks or nothing has spoken for long enough.
        let now = Date()
        let started = firstLook ?? now
        firstLook = started
        if isSignedIn == nil, now.timeIntervalSince(started) > 6 { isSignedIn = false }
    }

    /// After a sign-out, the web view's own report is stale by definition.
    func forgetWebReport() {
        reportedByWeb = false
    }

    /// Put the actual sign-in surface in front of a request that discovered an
    /// expired session. The editor used to stay visible and tell the creator
    /// to find another tab themselves, even though the app already owns a
    /// complete sign-in flow.
    func requireSignIn() {
        reportedByWeb = false
        firstLook = nil
        isSignedIn = false
        startWatching()
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
