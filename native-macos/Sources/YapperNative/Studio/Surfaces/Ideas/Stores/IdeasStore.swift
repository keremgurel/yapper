import Foundation

/// Every idea, whatever its status: the one list. Kept across tab switches so
/// coming back to Ideas shows the last list at once while it re-reads.
@MainActor
final class IdeasStore: ObservableObject {
    static let shared = IdeasStore()

    @Published private(set) var items: [IdeaItem]?
    @Published private(set) var loadError: String?
    @Published private(set) var refreshFailed = false

    var loading: Bool { items == nil && loadError == nil }

    /// Every reference link already in the list, for import de-duplication.
    var sourceURLs: [String] { (items ?? []).compactMap(\.sourceUrl) }

    func refresh() async {
        do {
            let response: IdeaListResponse = try await StudioJSONClient.get("api/ideas")
            items = response.items
            loadError = nil
            refreshFailed = false
        } catch {
            if items == nil { loadError = error.localizedDescription } else { refreshFailed = true }
        }
    }

    func prepend(_ item: IdeaItem) {
        items = [item] + (items ?? []).filter { $0.id != item.id }
    }

    func update(_ id: String, _ change: (inout IdeaItem) -> Void) {
        guard let index = items?.firstIndex(where: { $0.id == id }) else { return }
        change(&items![index])
    }

    func item(_ id: String) -> IdeaItem? { items?.first { $0.id == id } }
}
