import Foundation

/// The creator's platform connections: one read, disconnect, and a re-read
/// whenever the window comes back to the front (an OAuth window just closed).
@MainActor
final class ConnectionsStore: ObservableObject {
    static let shared = ConnectionsStore()

    @Published private(set) var response: ConnectionsResponse?
    @Published private(set) var error: String?
    @Published private(set) var pending: Set<PublishPlatform> = []

    var loading: Bool { response == nil && error == nil }

    func connection(for platform: PublishPlatform) -> ConnectionSummary? {
        response?.connections.first { $0.platform == platform.rawValue }
    }

    func canConnect(_ platform: PublishPlatform) -> Bool {
        response?.available.contains(platform.rawValue) ?? false
    }

    func refresh() async {
        do {
            response = try await StudioJSONClient.get("api/publish/connections")
            error = nil
        } catch {
            if response == nil { self.error = error.localizedDescription }
        }
    }

    func disconnect(_ platform: PublishPlatform) async {
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
        StudioWebCommands.shared.openOAuth(path: "/api/publish/connect/\(platform.rawValue)")
    }
}
