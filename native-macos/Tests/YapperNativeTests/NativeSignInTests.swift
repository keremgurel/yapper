import Foundation
import Testing
@testable import YapperNative

/// Which navigations get sent to a real browser.
///
/// Both directions matter. Miss one and Google answers an embedded web view
/// with `disallowed_useragent`, which reads as the sign-in button being broken.
/// Catch one too many and typing an email address throws the creator out of the
/// app for no reason.
@Suite
struct NativeSignInTests {
    private func url(_ string: String) -> URL { URL(string: string)! }

    @Test("Providers that refuse embedded web views go to the browser")
    func providers() {
        #expect(NativeSignIn.needsSystemBrowser(url("https://accounts.google.com/o/oauth2/v2/auth?x=1")))
        #expect(NativeSignIn.needsSystemBrowser(url("https://appleid.apple.com/auth/authorize")))
        #expect(NativeSignIn.needsSystemBrowser(url("https://github.com/login/oauth/authorize")))
    }

    @Test("Clerk's kickoff is caught before the app leaves the page")
    func kickoff() {
        // Clerk sends the browser to its own endpoint first and only then to
        // Google. Cancelling here means the sign-in card stays on screen.
        #expect(
            NativeSignIn.needsSystemBrowser(
                url("https://clerk.ypr.app/v1/oauth_google?redirect_url=x")
            )
        )
        #expect(
            NativeSignIn.needsSystemBrowser(
                url("https://communal-parakeet-81.accounts.dev/v1/oauth_apple")
            )
        )
    }

    @Test("Everything else stays in the window")
    func staysInApp() {
        // The sign-in card itself, and every ordinary page.
        #expect(!NativeSignIn.needsSystemBrowser(url("https://ypr.app/studio/app-sign-in")))
        #expect(!NativeSignIn.needsSystemBrowser(url("https://ypr.app/studio/home")))
        // Clerk's own API calls: the email and password flow is made of these,
        // and sending one to a browser would break signing in with a password.
        #expect(
            !NativeSignIn.needsSystemBrowser(
                url("https://clerk.ypr.app/v1/client/sign_ins?_clerk_js_version=5")
            )
        )
        #expect(
            !NativeSignIn.needsSystemBrowser(
                url("https://clerk.ypr.app/v1/client/sign_ins/attempt_first_factor")
            )
        )
    }

    @Test("A host that merely looks like a provider is not one")
    func lookalikes() {
        #expect(!NativeSignIn.needsSystemBrowser(url("https://notaccounts.google.com.evil.test/")))
        #expect(!NativeSignIn.needsSystemBrowser(url("https://ypr.app/blog/oauth_google")))
        #expect(!NativeSignIn.needsSystemBrowser(url("file:///tmp/x.html")))
    }
}
