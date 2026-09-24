import Foundation

/// One row of the Ideas list, as `GET /api/ideas` and `GET /api/content`
/// return it. Whatever its status, every idea has this shape.
///
/// Decoding is forgiving on the fields a newer server might leave out, so one
/// odd row never empties the whole list.
struct IdeaItem: Codable, Equatable, Identifiable {
    let id: String
    var title: String
    var status: String
    var stage: String
    var formats: [String]
    /// The format the idea started in, and the others it has a version of.
    var leadFormat: String
    var versionFormats: [String]
    var ideaType: String?
    var scheduledFor: String?
    var submissionId: String?
    var pillar: String?
    var pillarId: String?
    var sourceUrl: String?
    var sourceTitle: String?
    var sourcePlatform: String?
    var transcriptStatus: String?
    var script: String?
    var originalNote: String
    var updatedAt: String
    var createdAt: String

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        title = try c.decodeIfPresent(String.self, forKey: .title) ?? ""
        status = try c.decodeIfPresent(String.self, forKey: .status) ?? IdeaStatus.captured.rawValue
        stage = try c.decodeIfPresent(String.self, forKey: .stage) ?? "bank"
        formats = try c.decodeIfPresent([String].self, forKey: .formats) ?? []
        leadFormat = try c.decodeIfPresent(String.self, forKey: .leadFormat) ?? "short"
        versionFormats = (try? c.decodeIfPresent([String].self, forKey: .versionFormats)) ?? []
        ideaType = try c.decodeIfPresent(String.self, forKey: .ideaType)
        scheduledFor = try c.decodeIfPresent(String.self, forKey: .scheduledFor)
        submissionId = try c.decodeIfPresent(String.self, forKey: .submissionId)
        pillar = try c.decodeIfPresent(String.self, forKey: .pillar)
        pillarId = try c.decodeIfPresent(String.self, forKey: .pillarId)
        sourceUrl = try c.decodeIfPresent(String.self, forKey: .sourceUrl)
        sourceTitle = try c.decodeIfPresent(String.self, forKey: .sourceTitle)
        sourcePlatform = try c.decodeIfPresent(String.self, forKey: .sourcePlatform)
        transcriptStatus = try c.decodeIfPresent(String.self, forKey: .transcriptStatus)
        script = try c.decodeIfPresent(String.self, forKey: .script)
        originalNote = try c.decodeIfPresent(String.self, forKey: .originalNote) ?? ""
        updatedAt = try c.decodeIfPresent(String.self, forKey: .updatedAt) ?? ""
        createdAt = try c.decodeIfPresent(String.self, forKey: .createdAt) ?? ""
    }

    /// Every format this idea has written, the lead included.
    var versions: Set<String> { Set([leadFormat] + versionFormats) }

    /// The pipeline status, reading anything unknown as a fresh capture.
    var pipelineStatus: IdeaStatus { IdeaStatus(rawValue: status) ?? .captured }

    /// What the row is called on screen: the title, else the first line of
    /// the creator's words, else a placeholder.
    var displayTitle: String {
        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmed.isEmpty { return trimmed }
        let line = originalNote
            .split(whereSeparator: { $0 == "." || $0 == "\n" })
            .first.map { $0.trimmingCharacters(in: .whitespaces) } ?? ""
        if line.isEmpty { return "Untitled idea" }
        return line.count > 80 ? String(line.prefix(80)) + "…" : line
    }

    var hasScript: Bool {
        !(script ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var updatedDate: Date? { IdeaDates.parse(updatedAt) }
}

/// `{ items }` from `GET /api/ideas`.
struct IdeaListResponse: Decodable {
    let items: [IdeaItem]
}

/// `{ item }` from `POST /api/ideas`, `POST /api/content` and
/// `PATCH /api/content/[id]`. The detail routes carry more fields; only the
/// row fields are read.
struct IdeaItemResponse: Decodable {
    let item: IdeaItem
}

/// The routes stamp ISO 8601 with fractional seconds.
enum IdeaDates {
    nonisolated(unsafe) private static let fractional: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
    nonisolated(unsafe) private static let plain = ISO8601DateFormatter()

    static func parse(_ value: String) -> Date? {
        fractional.date(from: value) ?? plain.date(from: value)
    }

    /// "Sep 3 · 2:14 PM", the web table's Updated cell.
    static func stamp(_ value: String) -> String {
        guard let date = parse(value) else { return "" }
        let day = date.formatted(.dateTime.month(.abbreviated).day())
        let time = date.formatted(.dateTime.hour().minute())
        return "\(day) · \(time)"
    }
}
