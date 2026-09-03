# Independent web and native accounts

Clerk multi-session handling is not required or enabled by this change.
Each surface keeps one account at a time. To change accounts in a surface,
sign out there and sign in again; remembered account switching is deferred.

The native WKWebView keeps its own persistent cookie store, separate from the
regular browser. Email/password sign-in stays in that store. Google and other
browser-based sign-ins use `ASWebAuthenticationSession` with
`prefersEphemeralWebBrowserSession = true`, rather than opening a normal browser
tab and inheriting its Clerk account. The private session returns a short-lived
Clerk ticket, redeemed only in the native web view after callback/state validation.
Cancellation or failure does not fall back to the regular browser.

Apple notes that a third-party default browser on macOS may not honor the
private-session preference. If the existing browser account appears without a
fresh login, cancel and use email/password in the app, or set Safari as the
default browser before retrying. See [Apple's documentation](https://developer.apple.com/documentation/authenticationservices/aswebauthenticationsession/prefersephemeralwebbrowsersession).

## Release verification (two test accounts; multi-session disabled)

1. Sign into account A in the regular browser.
2. Sign into account B in the native app using email/password. Reload both;
   each must retain its own account and projects.
3. Sign out in native only, then sign into B using Google/private browser login.
   Browser A must remain signed in and unchanged.
4. Sign out of either surface; the other must remain signed in.
5. Cancel a private sign-in, then retry. Verify the app returns to its sign-in
   screen and does not become stuck waiting for a callback.
6. Relaunch the native app and verify its account persists independently.

Automated tests cover private-session configuration, callback validation, and
ticket issuance. Real two-account OAuth testing is still required before release.
The native app must be rebuilt/distributed for the handoff change to take effect.
