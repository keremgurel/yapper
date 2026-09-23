import Foundation

/// How a Knowledge block holds what it holds.
enum BrainBlockKind: String, Codable, CaseIterable, Sendable {
    case note, list, table, doc

    var symbol: String {
        switch self {
        case .note: "doc.text"
        case .list: "list.bullet"
        case .table: "tablecells"
        case .doc: "scroll"
        }
    }
}

/// How much of a block reaches a prompt, and when.
enum BrainBlockUsage: String, Codable, CaseIterable, Sendable {
    case core, auto, manual, `private`

    var label: String {
        switch self {
        case .core: "Always"
        case .auto: "When relevant"
        case .manual: "On request"
        case .private: "Private"
        }
    }

    var help: String {
        switch self {
        case .core: "Read on every piece of writing. Keep this for who you are, not for reference material."
        case .auto: "Summarised in every prompt, read in full when what you are writing is about it."
        case .manual: "Kept back until you ask for it by name."
        case .private: "Never leaves this page. Yours to read, not the model's."
        }
    }

    var tone: NativeChip.Tone {
        switch self {
        case .core: .green
        case .auto: .cyan
        case .manual: .neutral
        case .private: .yellow
        }
    }
}

/// An imported grid.
struct BrainTable: Codable, Equatable, Sendable {
    var columns: [String]
    var rows: [[String]]

    var json: BrainJSONValue {
        .object(["columns": .strings(columns), "rows": .array(rows.map(BrainJSONValue.strings))])
    }
}

/// One Knowledge block, as `/api/brain/blocks` returns it.
struct BrainBlock: Codable, Equatable, Identifiable, Sendable {
    let id: String
    var title: String
    var kind: BrainBlockKind
    var body: String
    var items: [String]
    var rows: BrainTable?
    var digest: String
    var usage: BrainBlockUsage
    var tags: [String]
    var sourceLabel: String
    var sourceUrl: String
    var charCount: Int
    var sortOrder: Int

    /// The shape, for a row whose digest is still empty.
    var shapeDescription: String {
        switch kind {
        case .table:
            let rowCount = rows?.rows.count ?? 0
            let columnCount = rows?.columns.count ?? 0
            return "table, \(rowCount) row\(rowCount == 1 ? "" : "s"), \(columnCount) column\(columnCount == 1 ? "" : "s")"
        case .list: return "list, \(items.count) line\(items.count == 1 ? "" : "s")"
        case .doc: return "document"
        case .note: return "note"
        }
    }

    /// Compact size for the end of a row, in characters.
    var sizeLabel: String {
        if charCount < 1_000 { return "\(charCount)" }
        let thousands = Double(charCount) / 1_000
        return charCount < 10_000 ? String(format: "%.1fk", thousands) : String(format: "%.0fk", thousands)
    }
}

struct BrainBlocksResponse: Codable, Sendable { let blocks: [BrainBlock] }
struct BrainBlockResponse: Codable, Sendable { let block: BrainBlock }

/// One change to a block.
enum BrainBlockEdit: Equatable, Sendable {
    case title(String)
    case digest(String)
    case body(String)
    case items([String])
    case rows(BrainTable)
    case usage(BrainBlockUsage)
    case tags([String])
    case sourceLabel(String)

    var patch: BrainPatch {
        switch self {
        case .title(let value): ["title": .string(value)]
        case .digest(let value): ["digest": .string(value)]
        case .body(let value): ["body": .string(value)]
        case .items(let value): ["items": .strings(value)]
        case .rows(let value): ["rows": value.json]
        case .usage(let value): ["usage": .string(value.rawValue)]
        case .tags(let value): ["tags": .strings(value)]
        case .sourceLabel(let value): ["sourceLabel": .string(value)]
        }
    }

    func apply(to block: inout BrainBlock) {
        switch self {
        case .title(let value): block.title = value
        case .digest(let value): block.digest = value
        case .body(let value): block.body = value
        case .items(let value): block.items = value
        case .rows(let value): block.rows = value
        case .usage(let value): block.usage = value
        case .tags(let value): block.tags = value
        case .sourceLabel(let value): block.sourceLabel = value
        }
    }
}

/// A block as it is created: a title, and whatever else is known.
struct NewBrainBlock: Equatable, Sendable {
    var title: String
    var kind: BrainBlockKind = .note
    var body = ""
    var items: [String] = []
    var rows: BrainTable?
    var digest = ""
    var usage: BrainBlockUsage?
    var tags: [String] = []
    var sourceLabel = ""

    var payload: BrainPatch {
        var body: BrainPatch = [
            "title": .string(title),
            "kind": .string(kind.rawValue),
            "body": .string(self.body),
            "items": .strings(items),
            "digest": .string(digest),
            "tags": .strings(tags),
            "sourceLabel": .string(sourceLabel),
        ]
        if let rows { body["rows"] = rows.json }
        if let usage { body["usage"] = .string(usage.rawValue) }
        return body
    }

    /// Sections most creators end up wanting, offered as a starting point.
    static let starters: [NewBrainBlock] = [
        NewBrainBlock(title: "Why I post", usage: .core),
        NewBrainBlock(title: "What I want out of this"),
        NewBrainBlock(title: "Who I am talking to, really", usage: .core),
        NewBrainBlock(title: "Hooks that work", kind: .list),
        NewBrainBlock(title: "Formats that work", kind: .list),
        NewBrainBlock(title: "Rules I keep", kind: .list, usage: .core),
    ]
}

/// Splits a typed tag line the way the web does: commas, trimmed, lowercased.
func brainParseTags(_ text: String, limit: Int = 8) -> [String] {
    Array(
        text.split(separator: ",")
            .map { $0.trimmingCharacters(in: .whitespaces).lowercased() }
            .filter { !$0.isEmpty }
            .prefix(limit)
    )
}
