import Foundation

/// One board column or table section.
struct IdeaGroup: Identifiable, Equatable {
    let id: String
    let label: String
    let items: [IdeaItem]

    var status: IdeaStatus? { IdeaStatus(rawValue: id) }
}

enum IdeaGrouping {
    /// Rows that match every filter a view saved. Empty filters narrow nothing.
    static func applyViewFilters(_ rows: [IdeaItem], _ filters: [String: [String]]) -> [IdeaItem] {
        let status = filters["status"] ?? []
        let formats = filters["formats"] ?? []
        let pillarIDs = filters["pillarId"] ?? []
        return rows.filter { row in
            if !status.isEmpty && !status.contains(row.status) { return false }
            if !pillarIDs.isEmpty && !pillarIDs.contains(row.pillarId ?? "") { return false }
            // Any one wanted format is a hit.
            if !formats.isEmpty && row.versions.isDisjoint(with: formats) { return false }
            return true
        }
    }

    /// Search over the title, the creator's words and the reference title,
    /// plus the one-pillar filter.
    static func search(_ rows: [IdeaItem], query: String, pillar: String?) -> [IdeaItem] {
        let needle = query.ideasTrimmed.lowercased()
        return rows.filter { row in
            if let pillar, row.pillar != pillar { return false }
            guard !needle.isEmpty else { return true }
            return row.title.lowercased().contains(needle)
                || row.originalNote.lowercased().contains(needle)
                || (row.sourceTitle?.lowercased().contains(needle) ?? false)
        }
    }

    static func pillarNames(_ rows: [IdeaItem]) -> [String] {
        Array(Set(rows.compactMap(\.pillar))).sorted { $0.localizedCompare($1) == .orderedAscending }
    }

    /// Status groups are always all there, in pipeline order, because an
    /// empty column is information and a drop target. Pillar and format
    /// groups only appear when something is in them.
    static func groups(_ rows: [IdeaItem], by grouping: ViewGrouping?) -> [IdeaGroup] {
        guard let grouping else { return [IdeaGroup(id: "all", label: "All", items: rows)] }
        switch grouping {
        case .status:
            return IdeaStatus.allCases.map { status in
                IdeaGroup(id: status.rawValue, label: status.label, items: rows.filter { $0.status == status.rawValue })
            }
        case .format:
            // By where each idea started, so every idea sits in exactly one group.
            return IdeaFormat.versioned.map { format in
                IdeaGroup(id: format.id, label: format.label, items: rows.filter { $0.leadFormat == format.id })
            }.filter { !$0.items.isEmpty }
        case .pillar:
            var order: [String] = []
            var labels: [String: String] = [:]
            var items: [String: [IdeaItem]] = [:]
            for row in rows {
                let key = row.pillarId ?? row.pillar ?? "__none"
                if items[key] == nil { order.append(key); labels[key] = row.pillar ?? "No pillar" }
                items[key, default: []].append(row)
            }
            // The unclassified bucket sorts last: it is a to-do, not a category.
            return order
                .map { IdeaGroup(id: $0, label: labels[$0] ?? "No pillar", items: items[$0] ?? []) }
                .sorted { a, b in
                    if a.id == "__none" { return false }
                    if b.id == "__none" { return true }
                    return a.label.localizedCompare(b.label) == .orderedAscending
                }
        }
    }
}
