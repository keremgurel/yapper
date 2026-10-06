import Foundation

/// The creator's platform connections: one read, disconnect, and a re-read
/// whenever the window comes back to the front (an OAuth window just closed).
@MainActor
final class ConnectionsStore: ObservableObject {
    static let shared = ConnectionsStore()

    @Published private(set) var response: ConnectionsResponse?
    @Published private(set) var error: String?
    @Published private(set) var pending: Set<PublishPlatform> = []

    @Published private(set) var connecting: PublishPlatform?
    private let loadConnections: () async throws -> ConnectionsResponse
    private var refreshGeneration = 0

    init(loadConnections: @escaping () async throws -> ConnectionsResponse = {
        try await StudioJSONClient.get("api/publish/connections")
    }) {
        self.loadConnections = loadConnections
    }

    var loading: Bool { response == nil && error == nil }

    func connection(for platform: PublishPlatform) -> ConnectionSummary? {
        response?.connections.first { $0.platform == platform.rawValue }
    }

    func canConnect(_ platform: PublishPlatform) -> Bool {
        response?.available.contains(platform.rawValue) ?? false
    }

    func refresh() async {
        refreshGeneration += 1
        let generation = refreshGeneration
        do {
            let fresh = try await loadConnections()
            guard generation == refreshGeneration else { return }
            response = fresh
            error = nil
        } catch {
            guard generation == refreshGeneration else { return }
            self.error = "Couldn't refresh connections. Try refreshing again."
        }
    }

    func beginConnecting(_ platform: PublishPlatform) {
        connecting = platform
        error = nil
    }

    func cancelConnecting(message: String? = nil) {
        connecting = nil
        error = message
    }

    func finishConnecting(at url: URL) async {
        let platform = connecting
        // OAuth writes through WKWebView, outside APITransport's usual write
        // invalidation. Otherwise refresh reuses the pre-login snapshot for
        // 20 seconds (and account-specific video lists can stay stale too).
        await APIReadCache.shared.clear()
        await refresh()
        guard connecting == platform else { return }
        connecting = nil
        let query = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems ?? []
        if query.contains(where: { $0.name == "connect_error" }) {
            error = "The account wasn't connected. Choose Connect to try again."
        }
    }

    func disconnect(_ platform: PublishPlatform) async {
        guard connecting == nil, !pending.contains(platform) else { return }
        pending.insert(platform)
        defer { pending.remove(platform) }
        do {
            try await StudioJSONClient.delete("api/publish/connections/\(platform.rawValue)")
            await refresh()
        } catch {
            self.error = "The disconnect couldn't be confirmed. Refresh to check, then try again."
        }
    }

    func connect(_ platform: PublishPlatform) {
        guard connecting == nil, pending.isEmpty else { return }
        StudioWebCommands.shared.openOAuth(path: "/api/publish/connect/\(platform.rawValue)")
    }
}
