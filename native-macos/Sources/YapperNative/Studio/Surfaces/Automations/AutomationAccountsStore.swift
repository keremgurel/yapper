import Foundation

/// The connected accounts the rule reads from and sends to. The save names
/// each account id so the server can refuse if an account changed meanwhile.
@MainActor
final class AutomationAccountsStore: ObservableObject {
    static let shared = AutomationAccountsStore()

    @Published private(set) var connections: [AutomationConnection]?
    @Published private(set) var failed = false

    func refresh() async {
        do {
            let response: AutomationConnectionsResponse = try await StudioJSONClient.get("api/publish/connections")
            connections = response.connections
            failed = false
        } catch {
            failed = true
        }
    }

    func account(_ platform: String) -> AutomationConnection? {
        connections?.first { $0.platform == platform && $0.status == "active" }
    }

    func label(_ platform: String) -> String {
        guard connections != nil else {
            return failed ? "Couldn't load account" : "Loading account…"
        }
        let account = account(platform)
        return account?.handle ?? account?.externalAccountId ?? "Not connected"
    }

    /// Active account ids by platform, as the save expects them.
    var expectedAccounts: [String: String] {
        var map: [String: String] = [:]
        for connection in connections ?? [] where connection.status == "active" {
            map[connection.platform] = connection.externalAccountId ?? ""
        }
        return map
    }

    /// Enabling needs Instagram and every chosen destination connected.
    func missing(for draft: AutomationDraft) -> Bool {
        guard draft.enabled else { return false }
        return account("instagram") == nil
            || draft.settings.destinations.contains { account($0.rawValue) == nil }
    }
}
