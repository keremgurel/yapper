import Foundation

/// Which channels are connected, with the account ids the publish routes
/// check. Connecting opens the platform's sign-in in the web session.
@MainActor
final class PosterConnectionStore: ObservableObject {
    static let shared = PosterConnectionStore()

    @Published private(set) var response: PosterConnections?
    @Published private(set) var failed = false

    /// Active connections in the app's platform order.
    var connected: [PublishPlatform] {
        let active = Set((response?.connections ?? []).filter { $0.status == "active" }.map(\.platform))
        return PublishPlatform.allCases.filter { active.contains($0.rawValue) }
    }

    /// What the publish sheet may post to: Facebook also needs its Page.
    var publishable: [PublishPlatform] {
        connected.filter { $0 != .facebook || accountID(for: .facebook) != nil }
    }

    func accountID(for platform: PublishPlatform) -> String? {
        let id = connection(platform)?.externalAccountId
        return id?.isEmpty == false ? id : nil
    }

    func accountLabel(for platform: PublishPlatform) -> String {
        connection(platform).flatMap { $0.handle ?? $0.externalAccountId } ?? "Connected account"
    }

    func refresh() async {
        do {
            response = try await PosterHTTP.get("api/publish/connections")
            failed = false
        } catch {
            failed = true
        }
    }

    func connect(_ platform: PublishPlatform) {
        StudioWebCommands.shared.openOAuth(path: "/api/publish/connect/\(platform.rawValue)")
    }

    private func connection(_ platform: PublishPlatform) -> PosterConnection? {
        response?.connections.first { $0.platform == platform.rawValue }
    }
}
