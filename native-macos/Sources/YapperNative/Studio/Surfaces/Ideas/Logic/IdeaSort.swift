import Foundation

enum IdeaSortKey: String {
    case title, status, updated, added, pillar, type, script
}

/// The table's sort: a column and a direction. Newest edits first at rest.
struct IdeaSort: Equatable {
    var key: IdeaSortKey = .updated
    var ascending = false

    /// Clicking the active column flips it; another column starts at its
    /// natural direction (time newest first, everything else A to Z).
    mutating func toggle(_ next: IdeaSortKey) {
        if next == key {
            ascending.toggle()
        } else {
            key = next
            ascending = next != .updated && next != .added
        }
    }

    /// A stable sorted copy: ties keep their incoming order.
    ///
    /// Each row's key is worked out once, up front. Comparing the rows
    /// directly parsed two ISO dates per comparison, about 9,000 parses to
    /// sort 500 ideas, and the list sorts on every render.
    func apply(_ rows: [IdeaItem]) -> [IdeaItem] {
        rows.enumerated()
            .map { (offset: $0.offset, key: sortKey($0.element), row: $0.element) }
            .sorted { a, b in
                let order = Self.compare(a.key, b.key)
                if order == 0 { return a.offset < b.offset }
                return ascending ? order < 0 : order > 0
            }
            .map(\.row)
    }

    private enum Key {
        case number(Double)
        case text(String)
    }

    private static let last = "\u{FFFF}"

    private func sortKey(_ row: IdeaItem) -> Key {
        switch key {
        case .title: .text(row.displaySortTitle)
        case .status: .number(Double(row.pipelineStatus.rank))
        case .updated: .number(row.updatedDate?.timeIntervalSince1970 ?? 0)
        case .added: .number(IdeaDates.parse(row.createdAt)?.timeIntervalSince1970 ?? 0)
        case .pillar: .text(row.pillar?.lowercased().nonEmpty ?? Self.last)
        case .type: .text(row.ideaType?.nonEmpty ?? Self.last)
        case .script: .number(row.hasScript ? 1 : 0)
        }
    }

    private static func compare(_ a: Key, _ b: Key) -> Int {
        switch (a, b) {
        case let (.number(left), .number(right)): left == right ? 0 : (left < right ? -1 : 1)
        case let (.text(left), .text(right)): order(left, right)
        default: 0
        }
    }

    private static func order(_ a: String, _ b: String) -> Int {
        switch a.localizedCompare(b) {
        case .orderedAscending: -1
        case .orderedDescending: 1
        case .orderedSame: 0
        }
    }
}

private extension IdeaItem {
    var displaySortTitle: String {
        let t = title.ideasTrimmed
        return (t.isEmpty ? "Untitled idea" : t).lowercased()
    }
}

private extension String {
    var nonEmpty: String? { isEmpty ? nil : self }
}
