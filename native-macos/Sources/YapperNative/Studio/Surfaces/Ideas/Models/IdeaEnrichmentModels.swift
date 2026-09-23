import Foundation

/// A pasted link, resolved by `POST /api/inspiration/resolve`.
struct ResolvedLink: Codable, Equatable {
    let kind: String?
    let platform: String?
    let title: String?
    let author: String?
    let transcript: String?
    let summary: String?
    let referenceType: String?
}

/// The resolved reference as the expand route and the item's source columns
/// take it.
struct IdeaSource: Codable, Equatable {
    let url: String
    let title: String?
    let platform: String?
    let transcript: String?
    let summary: String?
    let referenceType: String?

    init(url: String, resolved: ResolvedLink) {
        self.url = url
        title = resolved.title
        platform = resolved.platform
        transcript = resolved.transcript
        summary = resolved.summary
        referenceType = resolved.referenceType
    }
}

/// The body of `POST /api/ideas/expand`. Pillars and voice are read on the
/// server from the creator's project, so they are not sent.
struct ExpandRequest: Encodable {
    struct Input: Encodable {
        let transcript: String?
        let url: String?
        let source: IdeaSource?
    }
    let input: Input
}

struct IdeaExpansionSection: Codable, Equatable {
    let label: String
    let kind: String
    let text: String?
    let items: [String]?
}

/// The AI's plan for an idea. Never overwrites the creator's own words.
struct IdeaExpansion: Codable, Equatable {
    let title: String?
    let pillar: String?
    let format: String?
    let summary: String?
    let sections: [IdeaExpansionSection]?
    let hooks: [String]?
    let outline: [String]?
    let keyPoints: [String]?
    let script: String?
}

struct ExpandResponse: Decodable {
    let expansion: IdeaExpansion?
}

/// The body of `POST /api/ideas`: the creator's exact words, stored before
/// any AI work starts.
struct CreateIdeaRequest: Encodable {
    let originalNote: String
    let sourceUrl: String?
    let ideaType: String
    let transcriptStatus: String?
}

/// The body of `POST /api/content` for a blank idea.
struct CreateBlankRequest: Encodable {
    let status = "drafting"
}

/// The body of `PATCH /api/content/[id]` for a status change.
struct StatusPatch: Encodable {
    let status: String
    let scheduledFor: String?

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(status, forKey: .status)
        if let scheduledFor { try c.encode(scheduledFor, forKey: .scheduledFor) } else { try c.encodeNil(forKey: .scheduledFor) }
    }

    private enum CodingKeys: String, CodingKey { case status, scheduledFor }
}

/// `{ pillars }` from `GET /api/project`. The rest of the project is not
/// read here.
struct ProjectPillarsResponse: Decodable {
    struct Pillar: Decodable, Equatable, Identifiable {
        let id: String
        let name: String
    }
    let pillars: [Pillar]
}

/// `{ updated }` from `POST /api/content/bulk`.
struct BulkResponse: Decodable {
    let updated: Int
}

/// `{ imported }` from `POST /api/ideas/import`.
struct ImportResponse: Decodable {
    let imported: Int
}
