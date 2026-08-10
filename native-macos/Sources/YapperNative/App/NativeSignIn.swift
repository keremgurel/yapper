import Foundation

/// Which parts of signing in cannot happen inside the app's web view.
///
/// Email and password are fine there, and making somebody leave the app to type
/// an address is the difference between signing in and being sent away. Google
/// and Apple are the exception, and not by choice: Google refuses OAuth from an
/// embedded web view outright (`disallowed_useragent`), and Apple's is barely
/// better. Those get the creator's real browser, where their existing session
/// and password manager already are.
enum NativeSignIn {
    /// Hosts that will not do business with an embedded web view.
    private static let providerHosts = [
        "accounts.google.com",
        "accounts.youtube.com",
        "appleid.apple.com",
        "www.facebook.com",
        "facebook.com",
        "github.com",
        "login.microsoftonline.com",
        "www.linkedin.com",
        "discord.com",
        "x.com",
        "twitter.com",
        "api.twitter.com",
    ]

    /// True for a navigation that has to finish in a real browser.
    ///
    /// Catches Clerk's own kickoff as well as the provider itself. Clerk sends
    /// the browser to `/v1/oauth_google` first and only then to Google, and
    /// cancelling at the kickoff means the app never leaves the sign-in page it
    /// is showing.
    static func needsSystemBrowser(_ url: URL) -> Bool {
        guard let host = url.host?.lowercased() else { return false }
        if providerHosts.contains(host) { return true }

        let isClerkHost =
            host.hasSuffix(".accounts.dev")
            || host.hasSuffix("clerk.accounts.dev")
            || host.hasPrefix("clerk.")
            || host.hasPrefix("accounts.")
        guard isClerkHost else { return false }
        let path = url.path.lowercased()
        return path.contains("/oauth_") || path.contains("/oauth/authorize")
    }
}
