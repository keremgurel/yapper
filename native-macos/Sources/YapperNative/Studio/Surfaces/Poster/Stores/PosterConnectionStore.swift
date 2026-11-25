import Foundation

/// Which channels are connected, with the account ids the publish routes
/// check. Connecting opens the platform's sign-in in the web session.
@MainActor
final class PosterConnectionStore: ObservableObject {
    static let shared = PosterConnectionStore()

    @Published private(set) var response: PosterConnections?
    private var ownerID: String?
    @Published private(set) var failed = false

    var hasLoaded: Bool { ownerID == StudioAuth.shared.account?.userID && response != nil }

    /// Active connections in the app's platform order.
    var connected: [PublishPlatform] {
        guard hasLoaded else { return [] }
        let active = Set((response?.connections ?? []).filter { $0.status == "active" }.map(\.platform))
        return PublishPlatform.enabledCases.filter { active.contains($0.rawValue) }
    }

    /// What publishing may post to: Facebook also needs its Page.
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
        let owner = StudioAuth.shared.account?.userID
        if ownerID != owner {
            ownerID = owner
            response = nil
            failed = false
        }
        do {
            let connections: PosterConnections = try await PosterHTTP.get("api/publish/connections")
            guard owner == StudioAuth.shared.account?.userID else { return }
            response = connections
            failed = false
        } catch {
            guard owner == StudioAuth.shared.account?.userID else { return }
            failed = true
        }
    }

    func connect(_ platform: PublishPlatform) {
        StudioWebCommands.shared.openOAuth(path: "/api/publish/connect/\(platform.rawValue)")
    }

    private func connection(_ platform: PublishPlatform) -> PosterConnection? {
        guard hasLoaded else { return nil }
        return response?.connections.first { $0.platform == platform.rawValue }
    }
}
