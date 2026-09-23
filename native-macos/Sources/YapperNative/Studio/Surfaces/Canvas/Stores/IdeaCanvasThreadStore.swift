import Foundation

/// The conversation on one idea. Loaded once; each ask shows at once as a
/// pending line, then is replaced by the exchange the server saved. Clearing
/// starts the talk over without touching the canvas.
@MainActor
final class IdeaCanvasThreadStore: ObservableObject {
    @Published private(set) var messages: [IdeaCanvasMessage] = []
    @Published private(set) var failed = false

    private let path: String

    init(itemID: String) {
        path = "api/content/\(itemID)/messages"
    }

    func load() async {
        do {
            let data = try await StudioJSONClient.raw(path, method: "GET", body: nil)
            guard let parsed = IdeaCanvasMessage.parseList(data) else { throw URLError(.cannotParseResponse) }
            messages = parsed
            failed = false
        } catch {
            failed = true
        }
    }

    func pendingAsk(_ text: String) -> String {
        let id = "pending-\(UUID().uuidString)"
        messages.append(IdeaCanvasMessage(id: id, role: .creator, text: text, actions: [], pending: true))
        return id
    }

    func settle(_ pendingID: String, saved: [IdeaCanvasMessage]?) {
        messages.removeAll { $0.id == pendingID }
        if let saved { messages += saved }
    }

    func clear() async {
        let previous = messages
        messages = []
        do {
            try await StudioJSONClient.delete(path)
        } catch {
            messages = previous
        }
    }
}
