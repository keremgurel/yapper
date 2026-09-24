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
    func apply(_ rows: [IdeaItem]) -> [IdeaItem] {
        rows.enumerated().sorted { a, b in
            let order = compare(a.element, b.element)
            if order == 0 { return a.offset < b.offset }
            return ascending ? order < 0 : order > 0
        }.map(\.element)
    }

    private static let last = "\u{FFFF}"

    private func compare(_ a: IdeaItem, _ b: IdeaItem) -> Int {
        switch key {
        case .title:
            return Self.order(a.displaySortTitle, b.displaySortTitle)
        case .status:
            return a.pipelineStatus.rank - b.pipelineStatus.rank
        case .updated:
            let left = a.updatedDate?.timeIntervalSince1970 ?? 0
            let right = b.updatedDate?.timeIntervalSince1970 ?? 0
            return left == right ? 0 : (left < right ? -1 : 1)
        case .added:
            let left = IdeaDates.parse(a.createdAt)?.timeIntervalSince1970 ?? 0
            let right = IdeaDates.parse(b.createdAt)?.timeIntervalSince1970 ?? 0
            return left == right ? 0 : (left < right ? -1 : 1)
        case .pillar:
            return Self.order(a.pillar?.lowercased().nonEmpty ?? Self.last, b.pillar?.lowercased().nonEmpty ?? Self.last)
        case .type:
            return Self.order(a.ideaType?.nonEmpty ?? Self.last, b.ideaType?.nonEmpty ?? Self.last)
        case .script:
            return (a.hasScript ? 1 : 0) - (b.hasScript ? 1 : 0)
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
