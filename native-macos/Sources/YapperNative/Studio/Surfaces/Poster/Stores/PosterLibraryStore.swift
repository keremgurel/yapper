import Foundation

/// The creator's finished takes, including Poster uploads. Kept across
/// visits so the tab opens on what it showed last while a refresh runs.
@MainActor
final class PosterLibraryStore: ObservableObject {
    static let shared = PosterLibraryStore()

    @Published private(set) var items: [PosterContentItem]?
    @Published private(set) var loadFailed = false

    var videos: [PosterVideo] { PosterContentItem.postable(items ?? []).map(PosterVideo.init(item:)) }
    var loading: Bool { items == nil && !loadFailed }

    func refresh() async {
        do {
            let list: PosterContentList = try await PosterHTTP.get("api/content?surface=poster")
            items = list.items
            loadFailed = false
        } catch {
            // Stale rows stay visible; only an empty first load is a failure.
            if items == nil { loadFailed = true }
        }
    }

    /// Puts a just-uploaded row in place at once, so it never looks lost.
    func upsert(_ item: PosterContentItem) {
        var next = items ?? []
        next.removeAll { $0.id == item.id }
        next.insert(item, at: 0)
        items = next
    }
}
