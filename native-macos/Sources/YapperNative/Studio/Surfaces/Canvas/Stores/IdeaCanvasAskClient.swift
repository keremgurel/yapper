import Foundation

/// Why an ask came back empty, in the creator's terms.
enum IdeaCanvasAskError: Error, Equatable {
    case locked, insufficient, limited, failed

    var message: String {
        switch self {
        case .locked: "Asking Chirpy needs an active Yapper subscription."
        case .insufficient: "You're out of credits. Top up to keep asking Chirpy."
        case .limited: "That's as many asks as this hour allows. Try again in a bit."
        case .failed: "Chirpy couldn't finish that. Nothing changed; try again."
        }
    }
}

/// What the canvas route is told about the piece.
struct IdeaCanvasAskContext {
    var title: String
    var blocks: [IdeaCanvasBlock]
    var hooks: [String]
    var originalNote: String
    var sourceTitle: String?
    var sourceURL: String?
    var sourceExcerpt: String
    /// The version being edited, so the route writes in that format.
    var format: IdeaCanvasVersionFormat = .short
}

/// The body `use-canvas-ask` posts to `api/generate/canvas`.
struct IdeaCanvasAskBody: Encodable {
    struct Source: Encodable {
        let title: String?
        let url: String?
        let excerpt: String?
    }

    let instruction: String
    let title: String
    let blocks: [IdeaCanvasStoredBlock]
    let hooks: [String]
    let originalNote: String
    let source: Source
    let target: Int?
    let contentId: String
    let format: IdeaCanvasVersionFormat

    init(instruction: String, context: IdeaCanvasAskContext, target: Int?, contentID: String) {
        self.instruction = instruction.trimmingCharacters(in: .whitespacesAndNewlines)
        title = context.title
        blocks = IdeaCanvasActions.blocksForRequest(context.blocks)
        hooks = Array(context.hooks.prefix(8))
        originalNote = context.originalNote
        source = Source(title: context.sourceTitle, url: context.sourceURL, excerpt: String(context.sourceExcerpt.prefix(3000)))
        self.target = target
        contentId = contentID
        format = context.format
    }

    private enum CodingKeys: String, CodingKey {
        case instruction, title, blocks, hooks, originalNote, source, target, contentId, format
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(instruction, forKey: .instruction)
        try c.encode(title, forKey: .title)
        try c.encode(blocks, forKey: .blocks)
        try c.encode(hooks, forKey: .hooks)
        try c.encode(originalNote, forKey: .originalNote)
        try c.encode(source, forKey: .source)
        if let target { try c.encode(target, forKey: .target) } else { try c.encodeNil(forKey: .target) }
        try c.encode(contentId, forKey: .contentId)
        try c.encode(format.rawValue, forKey: .format)
    }
}

enum IdeaCanvasAskClient {
    static func ask(_ body: IdeaCanvasAskBody, blockCount: Int) async -> Result<IdeaCanvasAskReply, IdeaCanvasAskError> {
        do {
            let data = try await StudioJSONClient.raw(
                "api/generate/canvas", method: "POST", body: StudioJSONClient.encoder.encode(body)
            )
            return .success(IdeaCanvasAskReply.parse(data, blockCount: blockCount))
        } catch let error as StudioAPIError {
            if error.code == "not_entitled" { return .failure(.locked) }
            if error.status == 402 { return .failure(.insufficient) }
            if error.status == 429 { return .failure(.limited) }
            return .failure(.failed)
        } catch {
            return .failure(.failed)
        }
    }
}
