import Foundation

/// Bounded project-local context. Conversation and receipts deliberately live
/// outside the timeline snapshot, so Undo cannot erase the history of a request.
@MainActor
final class AssistantConversation: ObservableObject {
    static let limit = 20
    private struct Archive: Codable {
        var version: Int = 1
        var projectID: UUID
        var messages: [AssistantMessage]
        var results: [AppActionResult]
        var pending: [UUID]
    }
    @Published private(set) var messages: [AssistantMessage] = []
    @Published private(set) var isThinking = false
    private(set) var results: [AppActionResult] = []
    private var pending: [UUID] = []
    private var archiveURL: URL?
    private var projectID: UUID?
    private(set) var persistenceError: String?
    var isEmpty: Bool { messages.isEmpty && !isThinking }

    func attach(projectID: UUID, root: URL?) {
        let url = root?.appending(path: "chirpy-history.json")
        guard self.projectID != projectID || archiveURL != url else { return }
        self.projectID = projectID
        archiveURL = url
        messages = []; results = []; pending = []; isThinking = false
        if let url, let data = try? Data(contentsOf: url), data.count <= 1024 * 1024,
           let archive = try? JSONDecoder().decode(Archive.self, from: data), archive.projectID == projectID, archive.version == 1 {
            messages = Array(archive.messages.suffix(Self.limit))
            results = Array(archive.results.suffix(64))
            pending = Array(archive.pending.suffix(64))
            if !pending.isEmpty {
                messages.append(.chirpy("The previous request was interrupted. Check the saved edit before asking me to continue.", tone: .trouble))
                messages = Array(messages.suffix(Self.limit))
            }
        }
    }

    func ask(_ text: String) { append(.you(text)); isThinking = true }
    func answer(_ message: AssistantMessage) { isThinking = false; append(message) }
    func giveUp() { isThinking = false }
    func clear() { messages = []; isThinking = false; try? save() }

    /// Journal before editing. An uncertain invocation must never be replayed.
    func begin(_ invocationID: UUID) throws {
        guard !pending.contains(invocationID), !results.contains(where: { $0.invocationID == invocationID }) else {
            throw AppActionError("This request has already been handled. Read the saved state before continuing.")
        }
        pending.append(invocationID)
        pending = Array(pending.suffix(64))
        try save()
    }

    func finish(_ receipts: [AppActionResult], invocationID: UUID) throws {
        results = Array((results + receipts).suffix(64))
        pending.removeAll { $0 == invocationID }
        try save()
    }

    private func append(_ message: AssistantMessage) {
        messages = Array((messages + [message]).suffix(Self.limit))
        do { try save() } catch { persistenceError = error.localizedDescription }
    }

    private func save() throws {
        guard let archiveURL, let projectID else { return }
        let data = try JSONEncoder().encode(Archive(projectID: projectID, messages: messages, results: results, pending: pending))
        try data.write(to: archiveURL, options: .atomic)
        persistenceError = nil
    }
}
