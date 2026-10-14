import Testing
@testable import YapperNative

@MainActor
@Suite("Email-code sign-in")
struct EmailSignInTests {
    @Test("Only Clerk refusing the session counts as signed out")
    func clerkRefusals() {
        #expect(ClerkTokenRefresher.outcome(forRefusal: 401) == .ended)
        #expect(ClerkTokenRefresher.outcome(forRefusal: 404) == .ended)
        #expect(ClerkTokenRefresher.outcome(forRefusal: 422) == .ended)
        // A rate limit or an outage says nothing about the account.
        #expect(ClerkTokenRefresher.outcome(forRefusal: 429) == .unknown)
        #expect(ClerkTokenRefresher.outcome(forRefusal: 500) == .unknown)
        #expect(ClerkTokenRefresher.outcome(forRefusal: 0) == .unknown)
    }

    @Test("A launch with no Clerk session goes straight to the sign-in screen")
    func launchWithoutSession() async {
        let auth = StudioAuth()
        #expect(auth.isSignedIn == nil)
        await auth.refresh()
        #expect(auth.isSignedIn == false)
    }

    @Test("The web page's report still wins over Clerk's direct answer")
    func webReportWins() async {
        let auth = StudioAuth()
        auth.report(signedIn: true, userID: "creator", displayName: "Creator")
        await auth.refresh()
        #expect(auth.isSignedIn == true)
    }

    @Test("Clerk's error codes read as things a person can act on")
    func messages() {
        #expect(ClerkEmailCodeMessages.message(for: nil) == ClerkEmailCodeMessages.unreachable)
        #expect(ClerkEmailCodeMessages.message(code: "form_code_incorrect", clerkMessage: "Incorrect code")
            == "That code isn't right. Check the email and try again.")
        #expect(ClerkEmailCodeMessages.message(code: "verification_expired", clerkMessage: nil)
            == "That code has expired. Send a new one.")
        #expect(ClerkEmailCodeMessages.message(code: "form_param_format_invalid", clerkMessage: nil)
            == "That doesn't look like an email address.")
        // Unknown codes fall back to Clerk's own sentence, then a generic one.
        #expect(ClerkEmailCodeMessages.message(code: "brand_new_code", clerkMessage: "Clerk says no.") == "Clerk says no.")
        #expect(ClerkEmailCodeMessages.message(code: "brand_new_code", clerkMessage: nil) == "Something went wrong. Try again.")
    }

    @Test("The code field keeps digits only, and no more than six")
    func codeInput() {
        let model = EmailSignInModel()
        model.updateCode("12 a3-")
        #expect(model.code == "123")
        model.updateCode("12345")
        #expect(model.code == "12345")
    }

    @Test("Continue needs something that looks like an address")
    func canSend() {
        let model = EmailSignInModel()
        model.email = "  "
        #expect(!model.canSend)
        model.email = "creator"
        #expect(!model.canSend)
        model.email = " creator@example.com "
        #expect(model.canSend)
    }
}
