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
    private var workflows: [String: (EditorSession, ActionJSON) async throws -> Bool] = [:]
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

    func registerWorkflow<Input: AppActionInput>(_ type: Input.Type,
        execute: @escaping (EditorSession, Input) async throws -> Bool) {
        register(type, availability: { _ in .available }) { _, _ in
            throw AppActionError("Run this workflow on its own.")
        }
        workflows[Input.actionID.rawValue] = { session, arguments in
            let input = try JSONDecoder().decode(Input.self, from: JSONEncoder().encode(arguments))
            return try await execute(session, input)
        }
    }

    func availability(_ id: AppActionID, in session: EditorSession) -> AppActionAvailability {
        guard let entry = entries[id.rawValue] else { return .init(reason: "This action is unavailable in this app version.") }
        if session.activeOperation != nil { return .init(reason: "Wait for the current operation to finish.") }
        return entry.availability(session)
    }

    /// One model plan is one edit: no intermediate saves or Undo entries.
    /// All mutations share the edit slot and a single outer operation lease.
    func executeBatch(_ calls: [ChirpyActionCall], projectID: UUID, revision: Int,
                      in session: EditorSession, invocationIDs suppliedIDs: [UUID]? = nil) async -> [AppActionResult] {
        guard !calls.isEmpty else { return [] }
        let invocationIDs = suppliedIDs ?? calls.map { _ in UUID() }
        precondition(invocationIDs.count == calls.count)
        func receipts(_ status: AppActionStatus, _ message: String, mutations: [AppActionMutation] = []) -> [AppActionResult] {
            let replies = calls.enumerated().map { index, call in
                let mutation = mutations.indices.contains(index) ? mutations[index] : nil
                return AppActionResult(protocolVersion: AppActionContract.version, invocationID: invocationIDs[index],
                    projectID: projectID, revision: session.actionRevision, action: call.action,
                    status: status == .applied && mutation?.changes.isEmpty == true ? .unchanged : status,
                    message: mutation?.message ?? message, changes: status == .applied ? mutation?.changes ?? [] : [],
                    skippedIDs: mutation?.skippedIDs ?? [], persisted: status == .applied && mutation?.changes.isEmpty == false)
            }
            recentResults = Array((recentResults + replies).suffix(64))
            return replies
        }
        guard calls.count <= 8, session.activeOperation == nil else {
            return receipts(.rejected, "Wait for the current operation to finish.")
        }
        do {
            for call in calls {
                guard let entry = entries[call.action] else { throw AppActionError("This app version does not support that action.") }
                try ActionSchema.validate(.object(call.arguments), against: entry.descriptor.parameters)
            }
        } catch { return receipts(.rejected, error.localizedDescription) }
        if calls.contains(where: { workflows[$0.action] != nil }) {
            guard calls.count == 1, let call = calls.first, let workflow = workflows[call.action] else {
                return receipts(.rejected, "Run generation or transcription as its own request before making other edits.")
            }
            guard session.project.id == projectID, session.actionRevision == revision else {
                return receipts(.rejected, "The project changed while I was planning. Ask again using its current state.")
            }
            let before = session.project
            session.clearError()
            do {
                let canceled = try await workflow(session, .object(call.arguments))
                if canceled { return receipts(.canceled, "The workflow was canceled.") }
                if let error = session.errorMessage { return receipts(.failed, error) }
                guard before != session.project else { return receipts(.unchanged, session.statusMessage) }
                return receipts(.applied, session.statusMessage, mutations: [.init(message: session.statusMessage,
                    changes: [.init(targetID: projectID, property: "project", before: "Before workflow", after: "Saved workflow result")])])
            } catch { return receipts(.failed, error.localizedDescription) }
        }
        var replies: [AppActionResult] = []
        _ = await session.runTrackedLongOperation(.overlayAI) { _ in
            guard let rollback = await session.beginPreparedTimelineEdit() else {
                replies = receipts(.failed, "The pending edit could not be saved."); return
            }
            defer { session.endPreparedTimelineEdit() }
            guard session.project.id == projectID, session.actionRevision == revision else {
                replies = receipts(.rejected, "The project changed while I was planning. Ask again using its current state."); return
            }
            session.clearError()
            do {
                var mutations: [AppActionMutation] = []
                for call in calls {
                    try Task.checkCancellation()
                    let entry = self.entries[call.action]!
                    if let reason = entry.availability(session).reason { throw AppActionError(reason) }
                    mutations.append(try await entry.execute(session, .object(call.arguments)))
                }
                try Task.checkCancellation()
                guard session.project != rollback.project else {
                    replies = receipts(.unchanged, "Nothing needed changing.", mutations: mutations); return
                }
                let rebuild = calls.contains { self.entries[$0.action]!.descriptor.requiresRebuild }
                guard await session.commitPreparedTimelineEdit(rollbackState: rollback, requiresRebuild: rebuild,
                    successStatus: "Chirpy edit saved · ⌘Z to undo") else {
                    replies = receipts(.failed, session.errorMessage ?? "The changes could not be saved."); return
                }
                for mutation in mutations { mutation.afterCommit() }
                replies = receipts(.applied, "Saved.", mutations: mutations)
            } catch {
                await session.restoreEditState(rollback, rebuildPlayer: false, preserving: error)
                replies = receipts(error is CancellationError ? .canceled : .failed,
                    error is CancellationError ? "Request canceled. No changes were saved." : error.localizedDescription)
            }
        }
        return replies.isEmpty ? receipts(.canceled, "Request canceled.") : replies
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
        if workflows[request.action] != nil {
            return await executeBatch([.init(action: request.action, arguments: request.arguments)],
                projectID: request.projectID, revision: request.revision, in: session, invocationIDs: [request.id])[0]
        }
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
