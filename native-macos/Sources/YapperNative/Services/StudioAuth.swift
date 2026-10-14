import AppKit
import Foundation

/// Whether anybody is signed in.
///
/// Clerk is asked, not guessed at. The first version read the cookie jar for a
/// `__session` cookie on ypr.app, which is a guess about a shape that is
/// Clerk's to change and is split across two domains; it came back false for a
/// signed-in account and hid the entire sidebar. The web session reports its
/// own state (see `auth_state` in the web shell), and before the page has
/// loaded, Clerk's Frontend API answers for it.
@MainActor
final class StudioAuth: ObservableObject {
    static let shared = StudioAuth()

    /// nil until Clerk has answered. The shell shows neither Studio nor the
    /// sign-in screen until then, so neither flashes at the wrong person.
    @Published private(set) var isSignedIn: Bool?
    @Published private(set) var account: StudioAccountIdentity? {
        didSet { NativeAnalytics.shared.identify(account?.userID) }
    }

    var accountName: String { account?.displayName ?? "Account" }
    var accountInitial: String { String(accountName.prefix(1)).uppercased() }

    /// Set once the web session has spoken for itself. From then on it is the
    /// only voice: it is Clerk, running where the session lives.
    private var reportedByWeb = false
    private var watcher: Task<Void, Never>?

    /// What the web session says about itself.
    func report(
        signedIn: Bool,
        userID: String? = nil,
        displayName: String? = nil,
        email: String? = nil,
        imageURL: String? = nil
    ) {
        reportedByWeb = true
        // Replace the entire identity on every report, including reports from
        // older web builds without profile fields. Never retain another user's label.
        account = signedIn
            ? StudioAccountIdentity(userID: userID, displayName: displayName, email: email, imageURL: imageURL)
            : nil
        isSignedIn = signedIn
        if signedIn { stopWatching() }
    }

    func refresh() async {
        guard !reportedByWeb else { return }
        // Clerk is asked, not the cookie jar: the session cookie outlives the
        // session by months, and trusting it drew Home for an account that
        // was gone and let every read on the page fail before the sign-in
        // screen came up.
        let outcome = await ClerkTokenRefresher.check()
        guard !reportedByWeb else { return }
        switch outcome {
        case .active:
            isSignedIn = true
            await loadIdentityFromClerk()
        case .ended:
            account = nil
            isSignedIn = false
        case .unknown:
            // Clerk could not be reached, but this Mac holds a session Clerk
            // has not refused. Let the creator in: editing works offline, and
            // the first request the server turns down brings the sign-in
            // screen back through `requireSignIn`.
            if isSignedIn == nil { isSignedIn = true }
        }
    }

    /// Fills in the account name when the web page has not reported it,
    /// retrying briefly while Clerk finishes loading in the parked page.
    func loadIdentityFromClerk() async {
        guard account == nil else { return }
        for _ in 0..<30 {
            if reportedByWeb || account != nil { return }
            if let identity = await StudioWebCommands.shared.accountIdentity() {
                if !reportedByWeb {
                    account = StudioAccountIdentity(userID: identity.id, displayName: identity.name, email: identity.email, imageURL: identity.imageURL)
                }
                return
            }
            try? await Task.sleep(for: .seconds(1))
        }
    }

    /// After a sign-out, the web view's own report is stale by definition.
    func forgetWebReport() {
        reportedByWeb = false
        account = nil
    }

    /// Put the actual sign-in surface in front of a request that discovered an
    /// expired session. The editor used to stay visible and tell the creator
    /// to find another tab themselves, even though the app already owns a
    /// complete sign-in flow.
    func requireSignIn() {
        // One refused request is not proof the account is gone: a token that
        // lapsed a second ago reads the same. Flipping the window to the
        // sign-in door and back rebuilt every page, which is the "jump and
        // reset" after generating captions or clicking Post. Ask Clerk first.
        guard !confirmingSignOut else { return }
        confirmingSignOut = true
        Task { [weak self] in await self?.signOutIfSessionIsGone() }
    }

    /// Asks Clerk whether the account is really gone, and only then drops it
    /// and shows the sign-in door.
    func signOutIfSessionIsGone() async {
        StudioWebCommands.shared.forgetToken()
        // Clerk's own answer first. The page used to be the only witness, and
        // a page still loading after launch reads exactly like a signed-out
        // one, which put the sign-in screen in front of working accounts.
        let stillSignedIn: Bool
        switch await ClerkTokenRefresher.check() {
        case .active: stillSignedIn = true
        case .ended: stillSignedIn = false
        case .unknown: stillSignedIn = await StudioWebCommands.shared.accountIdentity() != nil
        }
        confirmingSignOut = false
        guard !stillSignedIn else { return }
        reportedByWeb = false
        account = nil
        isSignedIn = false
        startWatching()
    }

    private var confirmingSignOut = false

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

/// Display-only profile supplied by Clerk through the authenticated web shell.
/// Kept in memory so an earlier account cannot survive a new session or launch.
struct StudioAccountIdentity: Equatable {
    let userID: String
    let displayName: String
    let email: String?
    let imageURL: URL?

    init?(userID: String?, displayName: String?, email: String?, imageURL: String? = nil) {
        func nonempty(_ value: String?) -> String? {
            guard let value = value?.trimmingCharacters(in: .whitespacesAndNewlines),
                  !value.isEmpty else { return nil }
            return value
        }
        guard let userID = nonempty(userID) else { return nil }
        self.userID = userID
        self.imageURL = imageURL.flatMap(URL.init(string:)).flatMap { $0.scheme == "https" ? $0 : nil }
        self.email = nonempty(email)
        self.displayName = nonempty(displayName)
            ?? self.email?.split(separator: "@").first.map(String.init)
            ?? "Account"
    }
}
