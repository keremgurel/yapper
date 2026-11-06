import Foundation

/// One line of the conversation on an idea.
struct IdeaCanvasMessage: Identifiable, Equatable {
    enum Role: String { case creator, chirpy }

    let id: String
    let role: Role
    let text: String
    let actions: [IdeaCanvasAction]
    /// Shown before the server has saved it.
    var pending = false

    /// A row from `api/content/[id]/messages` or the canvas reply.
    static func parse(_ value: Any) -> IdeaCanvasMessage? {
        guard let raw = value as? [String: Any], let id = raw["id"] as? String,
              let text = raw["text"] as? String else { return nil }
        let actions = IdeaCanvasActionParser.parse(["actions": raw["actions"] ?? []], blockCount: Int.max)
        return IdeaCanvasMessage(id: id, role: raw["role"] as? String == "chirpy" ? .chirpy : .creator, text: text, actions: actions)
    }

    /// `{ messages: [...] }` from `GET api/content/[id]/messages`.
    static func parseList(_ data: Data) -> [IdeaCanvasMessage]? {
        guard let root = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else { return nil }
        return (root["messages"] as? [Any] ?? []).compactMap(parse)
    }
}

/// What `POST api/generate/canvas` answers: the actions (parsed against the
/// block count the ask was made with), Chirpy's note, and the saved exchange.
struct IdeaCanvasAskReply: Equatable {
    var actions: [IdeaCanvasAction]
    let note: String?
    let messages: [IdeaCanvasMessage]?
    /// The version as the server saved it, the base of the next autosave.
    var document: IdeaCanvasPatch?

    static func parse(_ data: Data, blockCount: Int) -> IdeaCanvasAskReply {
        let root = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
        let document = (root["document"] as? [String: Any])
            .flatMap { try? JSONSerialization.data(withJSONObject: ["item": $0]) }
            .flatMap { try? JSONDecoder().decode(IdeaCanvasSaveReply.self, from: $0) }
        return IdeaCanvasAskReply(
            actions: IdeaCanvasActionParser.parse(root, blockCount: blockCount),
            note: root["note"] as? String,
            messages: (root["messages"] as? [Any]).map { $0.compactMap(IdeaCanvasMessage.parse) },
            document: document?.fields
        )
    }

    /// Chirpy's saved reply, when the server wrote the exchange.
    var chirpyMessage: IdeaCanvasMessage? { messages?.first { $0.role == .chirpy } }
}
