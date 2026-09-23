import Foundation

/// Multi-select and the bulk edits it offers. Every bulk edit is confirmed by
/// re-reading the list, so a partly applied change never lingers on screen.
@MainActor
final class IdeaSelection: ObservableObject {
    static let shared = IdeaSelection()

    @Published private(set) var ids: Set<String> = []
    @Published private(set) var busy = false
    @Published private(set) var failed = false

    var count: Int { ids.count }

    func toggle(_ id: String) {
        if ids.contains(id) { ids.remove(id) } else { ids.insert(id) }
    }

    func select(_ all: [String]) { ids = Set(all) }
    func clear() { ids = []; failed = false }

    func run(_ action: BulkRequest.Action) {
        let targets = Array(ids)
        guard !targets.isEmpty, !busy else { return }
        busy = true
        failed = false
        Task {
            defer { busy = false }
            do {
                let reply: BulkResponse = try await StudioJSONClient.post("api/content/bulk", body: BulkRequest(ids: targets, action: action))
                await IdeasStore.shared.refresh()
                if reply.updated == targets.count { ids = [] } else { failed = true }
            } catch {
                await IdeasStore.shared.refresh()
                failed = true
            }
        }
    }

    /// Drops ids that are no longer in the list, after a delete elsewhere.
    func prune(to present: Set<String>) {
        let kept = ids.intersection(present)
        if kept != ids { ids = kept }
    }
}
