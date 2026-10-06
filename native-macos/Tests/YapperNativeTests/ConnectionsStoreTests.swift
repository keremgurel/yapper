import Foundation
import Testing
@testable import YapperNative

@MainActor
@Suite(.serialized)
struct ConnectionsStoreTests {
    @Test func oauthReturnDiscardsTheCachedDisconnectedSnapshot() async throws {
        let cache = APIReadCache.shared
        await cache.clear()
        let path = "api/publish/connections"
        let empty = try JSONEncoder().encode(ConnectionsResponse(connections: [], available: ["tiktok"]))
        let saved = try JSONEncoder().encode(connected)
        _ = try await cache.data(for: path) { empty }
        let store = ConnectionsStore(loadConnections: {
            let data = try await cache.data(for: path) { saved }
            return try JSONDecoder().decode(ConnectionsResponse.self, from: data)
        })
        await store.refresh()
        #expect(store.connection(for: .tiktok) == nil)

        // The OAuth web window has saved the connection, outside APITransport.
        store.beginConnecting(.tiktok)
        await store.finishConnecting(at: URL(string: "https://ypr.app/studio/connections?connected=tiktok")!)
        #expect(store.connection(for: .tiktok)?.handle == "Creator")
        #expect(store.connecting == nil)
        await cache.clear()
    }

    private let connected = ConnectionsResponse(
        connections: [.init(platform: "tiktok", handle: "Creator", status: "active", updatedAt: "now")],
        available: ["tiktok"]
    )

    @Test func remainsConnectingUntilSavedAccountArrives() async {
        var reply: CheckedContinuation<ConnectionsResponse, any Error>?
        let store = ConnectionsStore(loadConnections: {
            try await withCheckedThrowingContinuation { reply = $0 }
        })
        store.beginConnecting(.tiktok)
        let task = Task { await store.finishConnecting(at: URL(string: "https://ypr.app/studio/connections?connected=tiktok")!) }
        while reply == nil { await Task.yield() }
        #expect(store.connecting == .tiktok)
        #expect(store.connection(for: .tiktok) == nil)
        reply?.resume(returning: connected)
        await task.value
        #expect(store.connecting == nil)
        #expect(store.connection(for: .tiktok)?.handle == "Creator")
    }

    @Test func cancellationAndProviderErrorsAllowRetry() async {
        let store = ConnectionsStore(loadConnections: { .init(connections: [], available: ["tiktok"]) })
        store.beginConnecting(.tiktok)
        store.cancelConnecting()
        #expect(store.connecting == nil)
        #expect(store.error == nil)
        store.beginConnecting(.tiktok)
        await store.finishConnecting(at: URL(string: "https://studio.ypr.app/connections?connect_error=access_denied")!)
        #expect(store.connecting == nil)
        #expect(store.error != nil)
        #expect(store.connection(for: .tiktok) == nil)
    }

    @Test func failedRefreshDoesNotClaimSuccessfulConnection() async {
        let store = ConnectionsStore(loadConnections: { throw URLError(.notConnectedToInternet) })
        store.beginConnecting(.tiktok)
        await store.finishConnecting(at: URL(string: "https://ypr.app/studio/connections?connected=tiktok")!)
        #expect(store.connecting == nil)
        #expect(store.error != nil)
        #expect(store.connection(for: .tiktok) == nil)
    }

    @Test func olderReadCannotOverwriteOAuthRefresh() async {
        var oldReply: CheckedContinuation<ConnectionsResponse, any Error>?
        var calls = 0
        let store = ConnectionsStore(loadConnections: {
            calls += 1
            if calls == 1 { return try await withCheckedThrowingContinuation { oldReply = $0 } }
            return connected
        })
        let oldRead = Task { await store.refresh() }
        while oldReply == nil { await Task.yield() }
        store.beginConnecting(.tiktok)
        await store.finishConnecting(at: URL(string: "https://ypr.app/studio/connections?connected=tiktok")!)
        oldReply?.resume(returning: .init(connections: [], available: ["tiktok"]))
        await oldRead.value
        #expect(store.connection(for: .tiktok)?.status == "active")
    }

    @Test func recognizesOnlyTrustedCompletedReturns() {
        for address in [
            "https://ypr.app/studio/connections?connected=tiktok",
            "https://studio.ypr.app/connections?connected=tiktok",
            "https://www.ypr.app/studio/connections?connect_error=access_denied",
        ] { #expect(ConnectionOAuthReturn.matches(URL(string: address)!)) }
        for address in [
            "https://evil.example/studio/connections?connected=tiktok",
            "http://ypr.app/studio/connections?connected=tiktok",
            "https://ypr.app/studio/connections",
            "https://ypr.app/api/publish/callback/tiktok?code=test",
        ] { #expect(!ConnectionOAuthReturn.matches(URL(string: address)!)) }
    }
}
