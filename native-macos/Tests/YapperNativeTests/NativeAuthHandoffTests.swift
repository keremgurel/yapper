import Foundation
import Testing
@testable import YapperNative

/// The rules a sign-in callback has to pass.
///
/// This is the one place in the app where a URL from outside turns into a
/// signed-in session, so what is tested here is mostly what must be refused: a
/// callback nobody asked for, a stale one from an abandoned attempt, and a
/// well-formed one carrying nothing.
@Suite
struct NativeAuthHandoffTests {
    @Test("Native login requests an isolated browser session")
    @MainActor
    func requestsPrivateBrowserSession() {
        let session = NativeAuthHandoff.makeAuthenticationSession(
            url: URL(string: "https://ypr.app/studio/native-auth?state=abc")!
        ) { _, _ in }
        #expect(session.prefersEphemeralWebBrowserSession)
    }

    private func callback(
        scheme: String = "yapper-studio",
        host: String = "auth",
        path: String = "/callback",
        ticket: String? = "tkt_123",
        state: String? = "abc"
    ) -> URL {
        var components = URLComponents()
        components.scheme = scheme
        components.host = host
        components.path = path
        var items: [URLQueryItem] = []
        if let ticket { items.append(URLQueryItem(name: "ticket", value: ticket)) }
        if let state { items.append(URLQueryItem(name: "state", value: state)) }
        components.queryItems = items
        return components.url!
    }

    @Test("The callback we asked for hands over its ticket")
    func accepts() {
        #expect(NativeAuthHandoff.ticket(in: callback(), expecting: "abc") == "tkt_123")
    }

    @Test("A callback from another attempt is refused")
    func refusesStaleState() {
        // The whole point of `state`: a link from an abandoned sign-in, or one
        // somebody else sent, must not sign this window in.
        #expect(NativeAuthHandoff.ticket(in: callback(state: "other"), expecting: "abc") == nil)
        #expect(NativeAuthHandoff.ticket(in: callback(state: nil), expecting: "abc") == nil)
    }

    @Test("A callback arriving when nothing is in flight is refused")
    func refusesUnexpected() {
        #expect(NativeAuthHandoff.ticket(in: callback(), expecting: nil) == nil)
    }

    @Test("Someone else's link is not ours to act on")
    func refusesForeignURLs() {
        #expect(NativeAuthHandoff.ticket(in: callback(scheme: "https"), expecting: "abc") == nil)
        #expect(NativeAuthHandoff.ticket(in: callback(host: "evil"), expecting: "abc") == nil)
        #expect(NativeAuthHandoff.ticket(in: callback(path: "/other"), expecting: "abc") == nil)
    }

    @Test("A callback with no ticket in it is refused")
    func refusesEmptyTicket() {
        #expect(NativeAuthHandoff.ticket(in: callback(ticket: nil), expecting: "abc") == nil)
        #expect(NativeAuthHandoff.ticket(in: callback(ticket: ""), expecting: "abc") == nil)
    }
}
