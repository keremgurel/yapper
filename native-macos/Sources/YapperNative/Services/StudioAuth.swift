import AppKit
import Foundation

/// Whether anybody is signed in, as far as the app can tell.
///
/// Read from the web session's own cookies rather than kept as a flag: Clerk
/// owns the session, it can end without the app being told (an expiry, a sign
/// out in a browser tab), and a flag would go on claiming a session that is no
/// longer there. The cookie is the truth.
@MainActor
final class StudioAuth: ObservableObject {
    static let shared = StudioAuth()

    /// nil until the first look, so the window does not flash a sign-in screen
    /// at somebody who is already signed in.
    @Published private(set) var isSignedIn: Bool?

    private var watcher: Task<Void, Never>?

    func refresh() async {
        isSignedIn = await YapperAPI.hasSession()
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
