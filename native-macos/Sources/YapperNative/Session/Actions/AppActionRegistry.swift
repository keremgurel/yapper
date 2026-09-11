import Foundation

protocol AppActionInput: Codable, Sendable {
    static var actionID: AppActionID { get }
}

struct AppActionDescriptor: Codable, Sendable {
    let id: String
    let description: String
    let effect: String
    let parameters: ActionJSON
    let requiresRebuild: Bool
}

struct AppActionAvailability: Equatable, Sendable {
    let reason: String?
    var isAvailable: Bool { reason == nil }
    static let available = Self(reason: nil)
}

@MainActor
struct AppActionMutation {
    var message: String
    var changes: [AppActionChange] = []
    var skippedIDs: [UUID] = []
    var afterCommit: () -> Void = {}
}

/// Features register their executor and availability once. Discovery and typed
/// calls both use that registration; there is no dispatch switch on action IDs.
@MainActor
final class AppActionRegistry {
    private struct Entry {
        let descriptor: AppActionDescriptor
        let operation: LongOperation?
        let availability: (EditorSession) -> AppActionAvailability
        let execute: (EditorSession, ActionJSON) async throws -> AppActionMutation
    }
    private var entries: [String: Entry] = [:]
    private(set) var recentResults: [AppActionResult] = []

    var descriptors: [AppActionDescriptor] { entries.values.map(\.descriptor).sorted { $0.id < $1.id } }

    func register<Input: AppActionInput>(
        _ input: Input.Type,
        operation: LongOperation? = nil,
        availability: @escaping (EditorSession) -> AppActionAvailability,
        execute: @escaping (EditorSession, Input) async throws -> AppActionMutation
    ) {
        let id = Input.actionID.rawValue
        guard let metadata = ActionSchema.document["x-actions"]?.list?.first(where: { $0["id"]?.text == id }),
              let description = metadata["description"]?.text,
              let effect = metadata["effect"]?.text,
              let name = metadata["input"]?.text else { preconditionFailure("Missing action metadata: \(id)") }
        precondition(entries[id] == nil, "Duplicate action registration: \(id)")
        let parameters = ActionSchema.definition(name)
        entries[id] = Entry(descriptor: .init(id: id, description: description, effect: effect,
            parameters: parameters, requiresRebuild: metadata["requiresRebuild"] == .bool(true)),
            operation: operation, availability: availability, execute: { session, value in
                try ActionSchema.validate(value, against: parameters)
                let decoded = try JSONDecoder().decode(Input.self, from: JSONEncoder().encode(value))
                return try await execute(session, decoded)
            })
    }

    func availability(_ id: AppActionID, in session: EditorSession) -> AppActionAvailability {
        guard let entry = entries[id.rawValue] else { return .init(reason: "This action is unavailable in this app version.") }
        if session.activeOperation != nil { return .init(reason: "Wait for the current operation to finish.") }
        return entry.availability(session)
    }

    func execute(_ request: AppActionRequest, in session: EditorSession, owner: LongOperationLease? = nil) async -> AppActionResult {
        func result(_ status: AppActionStatus, _ message: String, mutation: AppActionMutation? = nil) -> AppActionResult {
            let result = AppActionResult(protocolVersion: AppActionContract.version, invocationID: request.id,
                projectID: request.projectID, revision: session.actionRevision, action: request.action, status: status,
                message: message, changes: status == .applied ? mutation?.changes ?? [] : [],
                skippedIDs: mutation?.skippedIDs ?? [], persisted: status == .applied)
            recentResults.append(result)
            if recentResults.count > 64 { recentResults.removeFirst(recentResults.count - 64) }
            session.setStatus(message)
            return result
        }
        do { try ActionSchema.validate(try .encoding(request), against: ActionSchema.definition("AppActionRequest")) }
        catch { return result(.rejected, error.localizedDescription) }
        guard let entry = entries[request.action] else { return result(.rejected, "This action is unavailable in this app version.") }
        do { try ActionSchema.validate(.object(request.arguments), against: entry.descriptor.parameters) }
        catch { return result(.rejected, error.localizedDescription) }
        func preflight() -> String? {
            if request.projectID != session.project.id { return "The active project changed. Read the current project before editing." }
            if request.revision != session.actionRevision { return "The project changed. Read its current state before editing." }
            if session.activeOperation != nil && session.activeOperation?.token != owner?.token {
                return "Wait for the current operation to finish."
            }
            return entry.availability(session).reason
        }
        if let reason = preflight() { return result(.rejected, reason) }
        guard !Task.isCancelled else { return result(.canceled, "Action canceled.") }
        if let operation = entry.operation, owner == nil {
            var reply: AppActionResult?
            let canceled = await session.runTrackedLongOperation(operation) { lease in
                reply = await self.execute(request, in: session, owner: lease)
            }
            return reply ?? result(canceled ? .canceled : .rejected,
                                   canceled ? "Action canceled." : "Wait for the current operation to finish.")
        }
        session.clearError()
        guard let rollback = await session.beginPreparedTimelineEdit() else {
            return result(.failed, session.errorMessage ?? "The pending edit could not be saved.")
        }
        defer { session.endPreparedTimelineEdit() }
        // Acquiring the edit slot and flushing a gesture can suspend. Validate
        // again before mutation so queued calls cannot act on stale targets.
        if let reason = preflight() { return result(.rejected, reason) }
        do {
            try Task.checkCancellation()
            let mutation = try await entry.execute(session, .object(request.arguments))
            try Task.checkCancellation()
            guard session.project != rollback.project else { return result(.unchanged, mutation.message, mutation: mutation) }
            let saved = await session.commitPreparedTimelineEdit(rollbackState: rollback,
                requiresRebuild: entry.descriptor.requiresRebuild, successStatus: mutation.message)
            guard saved else {
                if Task.isCancelled {
                    session.markCurrentLongOperationCanceled()
                    return result(.canceled, "Action canceled.")
                }
                return result(.failed, session.errorMessage ?? "The change could not be saved.")
            }
            mutation.afterCommit()
            return result(.applied, mutation.message, mutation: mutation)
        } catch is CancellationError {
            session.markCurrentLongOperationCanceled()
            await session.restoreCanceledEditState(rollback, rebuildPlayer: false, status: "Action canceled.")
            return result(.canceled, "Action canceled.")
        } catch {
            if session.project != rollback.project {
                await session.restoreEditState(rollback, rebuildPlayer: false, preserving: error)
            }
            return result(error is AppActionError ? .rejected : .failed, error.localizedDescription)
        }
    }
}

extension EditorSession {
    func actionRequest<Input: AppActionInput>(_ input: Input) throws -> AppActionRequest {
        guard case .object(let fields) = try ActionJSON.encoding(input) else { throw AppActionError("Invalid action arguments.") }
        return AppActionRequest(protocolVersion: AppActionContract.version, id: UUID(), projectID: project.id,
                                revision: actionRevision, action: Input.actionID.rawValue, arguments: fields)
    }

    @discardableResult
    func performAppAction<Input: AppActionInput>(_ input: Input, owner: LongOperationLease? = nil) async -> AppActionResult {
        do { return await appActions.execute(try actionRequest(input), in: self, owner: owner) }
        catch {
            let message = "Invalid action arguments."
            setStatus(message)
            return AppActionResult(protocolVersion: AppActionContract.version, invocationID: UUID(), projectID: project.id,
                revision: actionRevision, action: Input.actionID.rawValue, status: .rejected,
                message: message, changes: [], skippedIDs: [], persisted: false)
        }
    }
}
