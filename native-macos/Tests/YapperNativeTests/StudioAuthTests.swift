import Testing
@testable import YapperNative

@MainActor
@Suite("Native account identity")
struct StudioAuthTests {
    @Test("Account switches replace the name, email, and avatar initial together")
    func accountSwitch() {
        let auth = StudioAuth()
        #expect(auth.accountName == "Account")
        auth.report(signedIn: true, userID: "business", displayName: "Business", email: "team@example.com")
        #expect(auth.accountName == "Business")
        auth.report(signedIn: true, userID: "personal", displayName: "Kerem", email: "personal@example.com")
        #expect(auth.isSignedIn == true)
        #expect(auth.account?.userID == "personal")
        #expect(auth.accountName == "Kerem")
        #expect(auth.account?.email == "personal@example.com")
        #expect(auth.accountInitial == "K")
    }

    @Test("Signing out drops profile fields even if they accompany the report")
    func signOut() {
        let auth = StudioAuth()
        auth.report(signedIn: true, userID: "first", displayName: "First")
        auth.report(signedIn: false, userID: "first", displayName: "First")
        #expect(auth.isSignedIn == false)
        #expect(auth.account == nil)
        #expect(auth.accountName == "Account")
    }

    @Test("Old web builds and incomplete reports cannot retain a stale identity")
    func missingIdentity() {
        let auth = StudioAuth()
        auth.report(signedIn: true, userID: "first", displayName: "First")
        auth.report(signedIn: true)
        #expect(auth.isSignedIn == true)
        #expect(auth.account == nil)
        auth.report(signedIn: true, userID: " ", displayName: "Stale")
        #expect(auth.account == nil)
    }

    @Test("Profiles fall back to their email or a generic label, and update in place")
    func profileUpdate() {
        let auth = StudioAuth()
        auth.report(signedIn: true, userID: "first", displayName: " ", email: " creator@example.com ")
        #expect(auth.accountName == "creator")
        #expect(auth.account?.email == "creator@example.com")
        auth.report(signedIn: true, userID: "first", displayName: "New name")
        #expect(auth.accountName == "New name")
        #expect(auth.account?.email == nil)
        auth.report(signedIn: true, userID: "first")
        #expect(auth.accountName == "Account")
    }

    @Test("Session invalidation clears the displayed account immediately")
    func invalidation() {
        let auth = StudioAuth()
        auth.report(signedIn: true, userID: "first", displayName: "First")
        auth.forgetWebReport()
        #expect(auth.account == nil)
        auth.report(signedIn: true, userID: "second", displayName: "Second")
        auth.requireSignIn()
        defer { auth.stopWatching() }
        #expect(auth.account == nil)
        #expect(auth.isSignedIn == false)
    }
}
