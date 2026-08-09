import Foundation

/// Which media rows are picked, and what a click does to that.
///
/// The rules are the ones every list on this machine already uses, so nobody
/// has to learn them: a plain click replaces the selection, Command adds or
/// removes one, and Shift takes the run between the last thing picked and this
/// one. Kept as a value with no view attached so all of that is testable
/// without a mouse.
struct MediaSelection: Equatable, Sendable {
    private(set) var ids: Set<UUID> = []
    /// The row a Shift-click measures its run from. The last one picked
    /// deliberately, never one that arrived as part of a run.
    private(set) var anchor: UUID?

    enum Modifier: Equatable, Sendable {
        case none
        /// Command: add this one, or take it back out.
        case toggle
        /// Shift: everything between the anchor and this one.
        case extend
    }

    var isEmpty: Bool { ids.isEmpty }
    var count: Int { ids.count }

    func contains(_ id: UUID) -> Bool { ids.contains(id) }

    /// The selection after a click on `id`, given the order the rows are drawn
    /// in.
    func clicking(_ id: UUID, modifier: Modifier, in order: [UUID]) -> MediaSelection {
        var updated = self
        switch modifier {
        case .none:
            updated.ids = [id]
            updated.anchor = id
        case .toggle:
            if updated.ids.contains(id) {
                updated.ids.remove(id)
                // The anchor cannot be a row that is no longer picked, or the
                // next Shift-click measures from somewhere invisible.
                if updated.anchor == id { updated.anchor = updated.ids.first }
            } else {
                updated.ids.insert(id)
                updated.anchor = id
            }
        case .extend:
            guard
                let anchor = updated.anchor ?? order.first,
                let from = order.firstIndex(of: anchor),
                let to = order.firstIndex(of: id)
            else {
                updated.ids = [id]
                updated.anchor = id
                return updated
            }
            let run = from <= to ? order[from ... to] : order[to ... from]
            updated.ids = Set(run)
            // The anchor stays put, so dragging a Shift-click back and forth
            // grows and shrinks one run instead of leaving a trail.
            updated.anchor = anchor
        }
        return updated
    }

    /// The selection with everything that no longer exists dropped, which is
    /// what a delete or an undo leaves behind.
    func reconciled(against existing: [UUID]) -> MediaSelection {
        let alive = Set(existing)
        var updated = self
        updated.ids = ids.intersection(alive)
        updated.anchor = anchor.flatMap { alive.contains($0) ? $0 : nil }
        return updated
    }

    func selecting(_ ids: [UUID]) -> MediaSelection {
        var updated = self
        updated.ids = Set(ids)
        updated.anchor = ids.last
        return updated
    }

    static let empty = MediaSelection()
}
