import Foundation

/// A resolved reference, mapped onto the item's source columns.
struct SourcePatch: Encodable, Equatable {
    let sourceUrl: String
    let sourceTitle: String?
    let sourceTranscript: String?
    let sourceSummary: String?
    let sourceReferenceType: String?
    let sourcePlatform: String?
    let transcriptStatus: String

    init(_ source: IdeaSource) {
        sourceUrl = source.url
        sourceTitle = source.title
        sourceTranscript = source.transcript
        sourceSummary = source.summary
        sourceReferenceType = source.referenceType
        sourcePlatform = source.platform
        // Said as it is: a reference we could not hear is `needs_media`.
        if !(source.transcript ?? "").ideasTrimmed.isEmpty {
            transcriptStatus = "ready"
        } else if !(source.summary ?? "").ideasTrimmed.isEmpty {
            transcriptStatus = "unavailable"
        } else {
            transcriptStatus = "needs_media"
        }
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(sourceUrl, forKey: .sourceUrl)
        try c.ideasEncodeOrNull(sourceTitle, forKey: .sourceTitle)
        try c.ideasEncodeOrNull(sourceTranscript, forKey: .sourceTranscript)
        try c.ideasEncodeOrNull(sourceSummary, forKey: .sourceSummary)
        try c.ideasEncodeOrNull(sourceReferenceType, forKey: .sourceReferenceType)
        try c.ideasEncodeOrNull(sourcePlatform, forKey: .sourcePlatform)
        try c.encode(transcriptStatus, forKey: .transcriptStatus)
    }

    private enum CodingKeys: String, CodingKey {
        case sourceUrl, sourceTitle, sourceTranscript, sourceSummary, sourceReferenceType, sourcePlatform, transcriptStatus
    }
}

/// An AI expansion, mapped onto the item's body. `originalNote` is never
/// part of it: the creator's words are not the AI's to rewrite.
struct ExpansionPatch: Encodable, Equatable {
    struct Block: Encodable, Equatable {
        let label: String
        let kind: String
        let text: String?
        let items: [String]?
    }

    struct Hook: Encodable, Equatable {
        let text: String
        func encode(to encoder: Encoder) throws {
            var c = encoder.container(keyedBy: CodingKeys.self)
            try c.encode(text, forKey: .text)
            // Pattern attribution belongs to the hook engine, not an expansion.
            try c.encodeNil(forKey: .pattern)
            try c.encodeNil(forKey: .why)
        }
        private enum CodingKeys: String, CodingKey { case text, pattern, why }
    }

    let title: String?
    let blocks: [Block]
    let format: String?
    let summary: String?
    let hooks: [Hook]
    let script: String?
    let pillar: String?

    init(_ expansion: IdeaExpansion) {
        var blocks = (expansion.sections ?? []).compactMap { section -> Block? in
            let text = section.text?.ideasTrimmed ?? ""
            let items = section.items ?? []
            guard !text.isEmpty || !items.isEmpty else { return nil }
            return Block(label: section.label, kind: section.kind, text: text.isEmpty ? nil : text, items: items.isEmpty ? nil : items)
        }
        // The direction leads the page, so the canvas opens on the idea.
        if let direction = expansion.summary?.ideasTrimmed, !direction.isEmpty {
            blocks.insert(Block(label: "Direction", kind: "paragraph", text: direction, items: nil), at: 0)
        }
        // Older expansions only have the fixed fields; they become blocks too.
        if blocks.isEmpty {
            if let points = expansion.keyPoints, !points.isEmpty {
                blocks.append(Block(label: "Key points", kind: "bullets", text: nil, items: points))
            }
            if let outline = expansion.outline, !outline.isEmpty {
                blocks.append(Block(label: "Outline", kind: "steps", text: nil, items: outline))
            }
        }
        let script = [expansion.script?.ideasTrimmed, (expansion.sections ?? []).first { $0.kind == "script" }?.text?.ideasTrimmed]
            .compactMap { $0 }.first { !$0.isEmpty }

        let title = expansion.title ?? ""
        self.title = title.isEmpty ? nil : title
        self.blocks = blocks
        format = expansion.format
        summary = expansion.summary
        hooks = (expansion.hooks ?? []).map(Hook.init(text:))
        self.script = script
        pillar = expansion.pillar
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encodeIfPresent(title, forKey: .title)
        try c.encode(blocks, forKey: .blocks)
        try c.ideasEncodeOrNull(format, forKey: .format)
        try c.ideasEncodeOrNull(summary, forKey: .summary)
        try c.encode(hooks, forKey: .hooks)
        try c.ideasEncodeOrNull(script, forKey: .script)
        try c.ideasEncodeOrNull(pillar, forKey: .pillar)
    }

    private enum CodingKeys: String, CodingKey { case title, blocks, format, summary, hooks, script, pillar }
}

/// One bulk action on many rows, as `POST /api/content/bulk` takes it.
struct BulkRequest: Encodable {
    enum Action: Equatable {
        case status(IdeaStatus)
        case pillar(String?)
        case delete
    }

    let ids: [String]
    let action: Action

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(ids, forKey: .ids)
        switch action {
        case .status(let status):
            try c.encode("status", forKey: .action)
            try c.encode(status.rawValue, forKey: .status)
        case .pillar(let pillarID):
            try c.encode("pillar", forKey: .action)
            try c.ideasEncodeOrNull(pillarID, forKey: .pillarId)
        case .delete:
            try c.encode("delete", forKey: .action)
        }
    }

    private enum CodingKeys: String, CodingKey { case ids, action, status, pillarId }
}

extension KeyedEncodingContainer {
    mutating func ideasEncodeOrNull(_ value: String?, forKey key: Key) throws {
        if let value { try encode(value, forKey: key) } else { try encodeNil(forKey: key) }
    }
}

extension String {
    var ideasTrimmed: String { trimmingCharacters(in: .whitespacesAndNewlines) }
}
