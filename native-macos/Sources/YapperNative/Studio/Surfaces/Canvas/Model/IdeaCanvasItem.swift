import Foundation

/// One stored block, as `api/content/[id]` sends and accepts it.
struct IdeaCanvasStoredBlock: Codable, Equatable {
    var label: String
    var kind: String
    var text: String?
    var items: [String]?
}

/// A hook as the API sends it: an object on new rows, a bare string on
/// legacy ones. Only the text is kept; the canvas edits hooks as plain lines.
struct IdeaCanvasHook: Decodable, Equatable {
    let text: String

    init(from decoder: Decoder) throws {
        if let single = try? decoder.singleValueContainer(), let text = try? single.decode(String.self) {
            self.text = text
            return
        }
        let container = try decoder.container(keyedBy: CodingKeys.self)
        text = (try? container.decode(String.self, forKey: .text)) ?? ""
    }

    private enum CodingKeys: String, CodingKey { case text }
}

/// The full row from `GET api/content/[id]`, with only what the canvas reads.
struct IdeaCanvasItem: Decodable, Equatable {
    let id: String
    var title: String
    var status: IdeaCanvasStatus
    var formats: [String]
    var pillar: String?
    var pillarId: String?
    var submissionId: String?
    var scheduledFor: String?
    var hooks: [String]
    var blocks: [IdeaCanvasStoredBlock]
    var script: String?
    var originalNote: String
    var ideaType: String?
    var sourceUrl: String?
    var sourceTitle: String?
    var sourceTranscript: String?
    var sourceSummary: String?
    var recordedTranscript: String?
    var transcriptStatus: String?
    var points: [String]
    var example: String
    var cta: String

    private enum CodingKeys: String, CodingKey {
        case id, title, status, formats, pillar, pillarId, submissionId, scheduledFor, hooks, blocks, script
        case originalNote, ideaType, sourceUrl, sourceTitle, sourceTranscript, sourceSummary
        case recordedTranscript, transcriptStatus, points, example, cta
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        title = try c.decodeIfPresent(String.self, forKey: .title) ?? ""
        let rawStatus = try c.decodeIfPresent(String.self, forKey: .status) ?? ""
        status = IdeaCanvasStatus(rawValue: rawStatus) ?? .captured
        formats = try c.decodeIfPresent([String].self, forKey: .formats) ?? []
        pillar = try c.decodeIfPresent(String.self, forKey: .pillar)
        pillarId = try c.decodeIfPresent(String.self, forKey: .pillarId)
        submissionId = try c.decodeIfPresent(String.self, forKey: .submissionId)
        scheduledFor = try c.decodeIfPresent(String.self, forKey: .scheduledFor)
        hooks = (try c.decodeIfPresent([IdeaCanvasHook].self, forKey: .hooks) ?? [])
            .map { $0.text.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        blocks = try c.decodeIfPresent([IdeaCanvasStoredBlock].self, forKey: .blocks) ?? []
        script = try c.decodeIfPresent(String.self, forKey: .script)
        originalNote = try c.decodeIfPresent(String.self, forKey: .originalNote) ?? ""
        ideaType = try c.decodeIfPresent(String.self, forKey: .ideaType)
        sourceUrl = try c.decodeIfPresent(String.self, forKey: .sourceUrl)
        sourceTitle = try c.decodeIfPresent(String.self, forKey: .sourceTitle)
        sourceTranscript = try c.decodeIfPresent(String.self, forKey: .sourceTranscript)
        sourceSummary = try c.decodeIfPresent(String.self, forKey: .sourceSummary)
        recordedTranscript = try c.decodeIfPresent(String.self, forKey: .recordedTranscript)
        transcriptStatus = try c.decodeIfPresent(String.self, forKey: .transcriptStatus)
        points = try c.decodeIfPresent([String].self, forKey: .points) ?? []
        example = try c.decodeIfPresent(String.self, forKey: .example) ?? ""
        cta = try c.decodeIfPresent(String.self, forKey: .cta) ?? ""
    }

    /// Whether anything shows under "Where this came from".
    var hasOrigin: Bool {
        [sourceTitle, sourceUrl, sourceTranscript, sourceSummary, recordedTranscript]
            .contains { !($0 ?? "").isEmpty }
            || !originalNote.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    /// The local copy after an edit, before the server has confirmed it.
    func applying(_ patch: IdeaCanvasPatch) -> IdeaCanvasItem {
        var next = self
        if let title = patch.title { next.title = title }
        if let status = patch.status { next.status = status }
        if let formats = patch.formats { next.formats = formats }
        if let pillarId = patch.pillarId { next.pillarId = pillarId.value; next.pillar = nil }
        if let scheduledFor = patch.scheduledFor { next.scheduledFor = scheduledFor }
        if let hooks = patch.hooks { next.hooks = hooks }
        if let blocks = patch.blocks { next.blocks = blocks }
        if let script = patch.script { next.script = script.value }
        return next
    }
}

/// `{ item }`, the envelope `GET api/content/[id]` answers with.
struct IdeaCanvasItemEnvelope: Decodable {
    let item: IdeaCanvasItem
}
