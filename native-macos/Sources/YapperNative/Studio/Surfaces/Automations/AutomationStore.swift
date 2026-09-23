import Foundation

/// The saved rule, the server's availability, and recent activity. `load`
/// is a fresh read the editor resets from; `refresh` only updates what is
/// shown, so unsaved edits survive the 30 second poll.
@MainActor
final class AutomationStore: ObservableObject {
    static let shared = AutomationStore()

    @Published private(set) var response: AutomationResponse?
    /// The first read failed and there is nothing to show.
    @Published private(set) var loadFailed = false
    /// A later read failed; the shown settings stay.
    @Published private(set) var refreshFailed = false

    private var revision = 0

    /// Retrying a failed import only works while the rule runs.
    var canRetry: Bool {
        guard let response else { return false }
        return response.available && response.rule?.enabled == true
    }

    @discardableResult
    func load() async -> AutomationResponse? {
        await read()
    }

    func refresh() async {
        await read()
    }

    @discardableResult
    private func read() async -> AutomationResponse? {
        revision += 1
        let current = revision
        do {
            let result: AutomationResponse = try await StudioJSONClient.get("api/publish/automations")
            guard current == revision else { return nil }
            response = result
            loadFailed = false
            refreshFailed = false
            return result
        } catch {
            guard current == revision else { return nil }
            if response == nil { loadFailed = true } else { refreshFailed = true }
            return nil
        }
    }

    /// A save landed: show its rule and drop any read that started before it.
    func replaceRule(_ rule: AutomationRule) {
        revision += 1
        response?.rule = rule
    }

    /// Asks the server to import a failed run again. Throws the creator-facing message.
    func retry(_ run: AutomationRun) async throws {
        do {
            let _: AutomationRetryResponse = try await StudioJSONClient.post(
                "api/publish/automations/runs/\(run.id)", body: [String: String]()
            )
        } catch {
            throw ScheduleChangeError(message: AutomationErrorCopy.message(for: error))
        }
        await refresh()
    }
}
