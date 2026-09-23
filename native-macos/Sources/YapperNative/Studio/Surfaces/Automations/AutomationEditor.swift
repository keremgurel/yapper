import Foundation

/// The rule as the creator is editing it, before it is saved.
struct AutomationDraft: Equatable {
    var version: Int
    var enabled: Bool
    var settings: AutomationSettings

    init(_ response: AutomationResponse) {
        version = response.rule?.version ?? 0
        enabled = response.rule?.enabled ?? false
        settings = response.rule?.settings ?? .defaults
    }

    init(_ rule: AutomationRule) {
        version = rule.version
        enabled = rule.enabled
        settings = rule.settings
    }

    mutating func toggle(_ destination: AutomationDestination) {
        if let index = settings.destinations.firstIndex(of: destination) {
            settings.destinations.remove(at: index)
        } else {
            settings.destinations.append(destination)
        }
    }
}

/// Holds the unsaved rule and saves it.
@MainActor
final class AutomationEditor: ObservableObject {
    static let shared = AutomationEditor()

    @Published var draft: AutomationDraft? {
        didSet { if oldValue != nil, draft != oldValue { saved = false } }
    }
    @Published private(set) var saving = false
    @Published private(set) var saved = false
    @Published private(set) var error: String?

    func reset(from response: AutomationResponse) {
        draft = AutomationDraft(response)
        saved = false
        error = nil
    }

    func save(accounts: [String: String], store: AutomationStore) async {
        guard !saving, let draft else { return }
        saving = true
        saved = false
        error = nil
        defer { saving = false }
        do {
            let result: AutomationSaveResponse = try await StudioJSONClient.put(
                "api/publish/automations",
                body: AutomationSaveRequest(
                    enabled: draft.enabled, version: draft.version,
                    settings: draft.settings, expectedAccounts: accounts
                )
            )
            store.replaceRule(result.rule)
            self.draft = AutomationDraft(result.rule)
            saved = true
            await store.refresh()
        } catch {
            self.error = AutomationErrorCopy.message(for: error)
        }
    }
}
