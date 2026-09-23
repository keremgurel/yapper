import Foundation

/// One saved view above the Ideas list: its own layout, grouping, filters and
/// columns. `GET /api/views?stage=library` seeds the defaults on first read.
struct LibraryView: Codable, Equatable, Identifiable {
    let id: String
    var name: String
    var kind: String
    var groupBy: String?
    var filters: [String: [String]]
    var columns: [String]
    var sortOrder: Int

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        name = try c.decodeIfPresent(String.self, forKey: .name) ?? "View"
        kind = try c.decodeIfPresent(String.self, forKey: .kind) ?? ViewLayout.table.rawValue
        groupBy = try c.decodeIfPresent(String.self, forKey: .groupBy)
        filters = try c.decodeIfPresent([String: [String]].self, forKey: .filters) ?? [:]
        columns = try c.decodeIfPresent([String].self, forKey: .columns) ?? []
        sortOrder = try c.decodeIfPresent(Int.self, forKey: .sortOrder) ?? 0
    }

    var layout: ViewLayout { ViewLayout(rawValue: kind) ?? .table }
    var grouping: ViewGrouping? { groupBy.flatMap(ViewGrouping.init(rawValue:)) }

    var draft: ViewDraft {
        ViewDraft(name: name, kind: kind, groupBy: groupBy, filters: filters, columns: columns)
    }
}

/// The writable part of a view, as `POST /api/views` and
/// `PATCH /api/views/[id]` take it.
struct ViewDraft: Codable, Equatable {
    var name: String
    var kind: String
    var groupBy: String?
    var filters: [String: [String]]
    var columns: [String]

    static let fresh = ViewDraft(name: "New view", kind: ViewLayout.table.rawValue, groupBy: nil, filters: [:], columns: [])

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(name, forKey: .name)
        try c.encode(kind, forKey: .kind)
        // Null clears the grouping; leaving the key out would read the same,
        // but saying it keeps the request honest.
        if let groupBy { try c.encode(groupBy, forKey: .groupBy) } else { try c.encodeNil(forKey: .groupBy) }
        try c.encode(filters, forKey: .filters)
        try c.encode(columns, forKey: .columns)
    }
}

enum ViewLayout: String, CaseIterable {
    case table, board
    var label: String { self == .table ? "Table" : "Board" }
    var symbol: String { self == .table ? "tablecells" : "rectangle.split.3x1" }
}

enum ViewGrouping: String, CaseIterable {
    case status, pillar, format
    var label: String {
        switch self {
        case .status: "Status"
        case .pillar: "Pillar"
        case .format: "Format"
        }
    }
}

struct LibraryViewsResponse: Decodable {
    let views: [LibraryView]
}

struct LibraryViewResponse: Decodable {
    let view: LibraryView
}
