import Foundation
import Testing
@testable import YapperNative

/// What a failed call says to the creator.
///
/// These are the sentences someone reads when the app stops working, and every
/// one of them has to point at the thing they can actually do about it. A
/// status code is not one of those things.
@Suite
struct YapperAPIFailureTests {
    private func message(_ status: Int, body: String = "") -> String {
        YapperAPI.failure(
            status: status,
            body: Data(body.utf8),
            action: "The AI edit"
        ).errorDescription ?? ""
    }

    @Test("A signed-out call asks the creator to sign in, whichever way it is refused")
    func signedOut() {
        // Clerk's `auth.protect()` answers a protected API route with 404 when
        // the caller has no session, so that a stranger cannot learn which
        // routes exist. It is the status the app sees most often after a sign
        // out, and it used to read as "failed (HTTP 404)".
        for status in [401, 403, 404] {
            #expect(message(status).contains("Sign in"), "status \(status)")
        }
    }

    @Test("Billing refusals say which of the two they are")
    func billing() {
        #expect(
            message(402, body: #"{"error":"not_entitled"}"#)
                .contains("active Yapper subscription")
        )
        #expect(
            message(402, body: #"{"error":"insufficient_credits"}"#)
                .contains("more Yapper credits")
        )
        // An unreadable body still has to say something useful; credits are the
        // likelier of the two and the cheaper thing to check.
        #expect(message(402, body: "not json").contains("credits"))
    }

    @Test("A server with no model configured is not the creator's problem")
    func unconfigured() {
        #expect(message(501).contains("not configured"))
    }

    @Test("Anything else names the action and the status")
    func unknown() {
        let text = message(500)
        #expect(text.contains("The AI edit"))
        #expect(text.contains("500"))
    }
}

@Suite
struct YapperAPICookieTests {
    private func cookie(
        name: String = "__session",
        domain: String = "ypr.app",
        path: String = "/",
        secure: Bool = true,
        expires: Date? = nil
    ) -> HTTPCookie {
        var properties: [HTTPCookiePropertyKey: Any] = [
            .name: name,
            .value: "v",
            .domain: domain,
            .path: path,
        ]
        if secure { properties[.secure] = "TRUE" }
        if let expires { properties[.expires] = expires }
        return HTTPCookie(properties: properties)!
    }

    private let url = URL(string: "https://ypr.app/api/transcribe")!

    @Test("A session cookie for the site is sent")
    func sends() {
        #expect(YapperAPI.cookieApplies(cookie(), to: url))
        #expect(YapperAPI.cookieApplies(cookie(domain: ".ypr.app"), to: url))
    }

    @Test("Another site's cookie is never sent")
    func withholds() {
        #expect(!YapperAPI.cookieApplies(cookie(domain: "tiktok.com"), to: url))
        // A near-miss host that merely ends in the same letters is not a match.
        #expect(!YapperAPI.cookieApplies(cookie(domain: "notypr.app"), to: url))
    }

    @Test("An expired cookie is not sent, so a dead session fails as signed out")
    func expiry() {
        #expect(
            !YapperAPI.cookieApplies(
                cookie(expires: Date(timeIntervalSince1970: 0)),
                to: url
            )
        )
        #expect(
            YapperAPI.cookieApplies(
                cookie(expires: Date(timeIntervalSinceNow: 3600)),
                to: url
            )
        )
    }

    @Test("A cookie scoped to another path stays there")
    func paths() {
        #expect(!YapperAPI.cookieApplies(cookie(path: "/studio"), to: url))
        #expect(YapperAPI.cookieApplies(cookie(path: "/api"), to: url))
    }
}
