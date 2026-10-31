import Foundation

/// Actions on the app rather than the open timeline: the project library and
/// the account dictionary. They run alone, outside the project's edit slot,
/// revision check and Undo, because they change which project is open or
/// something that is not in the project at all. An action marked `confirm`
/// asks the creator before a Chirpy plan may run it.
@MainActor
final class AppScopeActions {
    struct Outcome {
        let status: AppActionStatus
        let message: String
        let mutation: AppActionMutation?
    }

    private struct Entry {
        let availability: (EditorSession) -> AppActionAvailability
        let confirmation: ((EditorSession, ActionJSON) async throws -> AppActionConfirmation)?
        let execute: (EditorSession, ActionJSON) async throws -> AppActionMutation
    }

    private var entries: [String: Entry] = [:]

    func contains(_ id: String) -> Bool { entries[id] != nil }

    func add<Input: AppActionInput>(
        _ type: Input.Type,
        availability: @escaping (EditorSession) -> AppActionAvailability,
        confirmation: ((EditorSession, Input) async throws -> AppActionConfirmation)?,
        execute: @escaping (EditorSession, Input) async throws -> AppActionMutation
    ) {
        func decode(_ value: ActionJSON) throws -> Input {
            try JSONDecoder().decode(Input.self, from: JSONEncoder().encode(value))
        }
        entries[Input.actionID.rawValue] = Entry(
            availability: availability,
            confirmation: confirmation.map { ask in { session, value in try await ask(session, try decode(value)) } },
            execute: { session, value in try await execute(session, try decode(value)) }
        )
    }

    /// `fromAssistant` is true for a Chirpy plan, which must ask before an
    /// action that needs confirmation; a control's own click never asks again.
    func run(_ id: String, arguments: ActionJSON, in session: EditorSession, fromAssistant: Bool) async -> Outcome {
        guard let entry = entries[id] else {
            return .init(status: .rejected, message: "This action is unavailable in this app version.", mutation: nil)
        }
        if let reason = entry.availability(session).reason {
            return .init(status: .rejected, message: reason, mutation: nil)
        }
        session.clearError()
        do {
            if fromAssistant, let confirmation = entry.confirmation {
                let question = try await confirmation(session, arguments)
                guard await session.confirmAssistantAction(question) else {
                    return .init(status: .canceled, message: "Nothing changed: you chose Cancel.", mutation: nil)
                }
            }
            let mutation = try await entry.execute(session, arguments)
            if let error = session.errorMessage { return .init(status: .failed, message: error, mutation: nil) }
            return .init(status: mutation.changes.isEmpty ? .unchanged : .applied, message: mutation.message, mutation: mutation)
        } catch {
            return .init(status: error is AppActionError ? .rejected : .failed, message: error.localizedDescription, mutation: nil)
        }
    }
}
