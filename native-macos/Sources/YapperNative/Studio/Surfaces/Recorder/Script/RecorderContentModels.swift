import Foundation

/// One body block of a content item, as `GET /api/content/[id]` returns it.
struct RecorderContentBlock: Codable, Equatable {
    let label: String?
    let kind: String?
    let text: String?
    let items: [String]?
}

/// A hook variation. The detail route widens legacy string hooks to objects,
/// but a plain string still decodes so an older reply never breaks a take.
struct RecorderContentHook: Codable, Equatable {
    let text: String

    init(text: String) { self.text = text }

    init(from decoder: Decoder) throws {
        if let single = try? decoder.singleValueContainer(), let value = try? single.decode(String.self) {
            text = value
            return
        }
        let container = try decoder.container(keyedBy: CodingKeys.self)
        text = try container.decodeIfPresent(String.self, forKey: .text) ?? ""
    }
}

/// Another version of an idea (long-form, article, short) than its lead.
struct RecorderContentVersion: Codable, Equatable {
    let format: String
    let title: String?
    let hooks: [RecorderContentHook]
    let blocks: [RecorderContentBlock]
    let script: String?

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        format = try container.decode(String.self, forKey: .format)
        title = try container.decodeIfPresent(String.self, forKey: .title)
        hooks = try container.decodeIfPresent([RecorderContentHook].self, forKey: .hooks) ?? []
        blocks = try container.decodeIfPresent([RecorderContentBlock].self, forKey: .blocks) ?? []
        script = try container.decodeIfPresent(String.self, forKey: .script)
    }
}

/// The fields of a content item the teleprompter reads.
struct RecorderContentItem: Codable, Equatable, Identifiable {
    let id: String
    let title: String
    let hooks: [RecorderContentHook]
    let blocks: [RecorderContentBlock]
    let script: String?
    let leadFormat: String?
    let versions: [RecorderContentVersion]

    init(
        id: String, title: String, hooks: [RecorderContentHook] = [], blocks: [RecorderContentBlock] = [],
        script: String? = nil, leadFormat: String? = nil, versions: [RecorderContentVersion] = []
    ) {
        self.id = id
        self.title = title
        self.hooks = hooks
        self.blocks = blocks
        self.script = script
        self.leadFormat = leadFormat
        self.versions = versions
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        title = try container.decodeIfPresent(String.self, forKey: .title) ?? ""
        hooks = try container.decodeIfPresent([RecorderContentHook].self, forKey: .hooks) ?? []
        blocks = try container.decodeIfPresent([RecorderContentBlock].self, forKey: .blocks) ?? []
        script = try container.decodeIfPresent(String.self, forKey: .script)
        leadFormat = try container.decodeIfPresent(String.self, forKey: .leadFormat)
        versions = (try? container.decodeIfPresent([RecorderContentVersion].self, forKey: .versions)) ?? []
    }

    /// The item as one version reads: the lead is the item itself, any other
    /// format swaps in that version's words. Unknown formats read the lead.
    func showing(format: String?) -> RecorderContentItem {
        guard let format, format != leadFormat, let version = versions.first(where: { $0.format == format }) else {
            return self
        }
        let script = version.script ?? version.blocks.first { $0.kind == "script" }?.text
        return RecorderContentItem(
            id: id, title: version.title ?? title, hooks: version.hooks, blocks: version.blocks,
            script: script, leadFormat: leadFormat, versions: versions
        )
    }
}

/// `GET /api/content/[id]`
struct RecorderContentEnvelope: Codable, Equatable {
    let item: RecorderContentItem
}

/// One row of `GET /api/content`, enough to pick what to record.
struct RecorderContentSummary: Codable, Equatable, Identifiable {
    let id: String
    let title: String
    let script: String?
    let submissionId: String?
    let updatedAt: String

    var hasScript: Bool { !(script ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
}

/// `GET /api/content`
struct RecorderContentListResponse: Codable, Equatable {
    let items: [RecorderContentSummary]
}
