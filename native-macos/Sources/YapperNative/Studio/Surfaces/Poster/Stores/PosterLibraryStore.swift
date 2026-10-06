import Foundation

/// The creator's finished takes, including Poster uploads. Kept across
/// visits so the tab opens on what it showed last while a refresh runs.
@MainActor
final class PosterLibraryStore: ObservableObject {
    static let shared = PosterLibraryStore()

    @Published private(set) var items: [PosterContentItem]?
    @Published private(set) var projects: [ProjectListing] = []
    @Published private(set) var projectsLoaded = false
    @Published private(set) var loadFailed = false
    private var accountID: String?

    var belongsToCurrentAccount: Bool { accountID == StudioAuth.shared.account?.userID }

    var projectVideos: [PosterVideo] {
        let local = projects.filter { $0.summary.clipCount > 0 }.map(PosterVideo.init(project:))
        let localSources = Set(projects.map { "yapper://project/\($0.summary.id.uuidString.lowercased())" })
        let remote = PosterContentItem.postable(items ?? []).filter {
            $0.sourceUrl?.hasPrefix("yapper://project/") == true && !localSources.contains($0.sourceUrl ?? "")
        }.map(PosterVideo.init(item:))
        return local + remote
    }

    var videos: [PosterVideo] { PosterContentItem.postable((items ?? []).filter { $0.sourceUrl == "yapper://poster-upload" }).map(PosterVideo.init(item:)) }
    var loading: Bool { items == nil && !loadFailed }

    func refresh() async {
        let owner = StudioAuth.shared.account?.userID
        if accountID != owner { items = nil; loadFailed = false; accountID = owner }
        async let local = ProjectLibrary.shared.listings()
        async let cloud: Void = refreshUploads()
        if let listings = try? await local { projects = listings }
        projectsLoaded = true
        await cloud
        for listing in projects { PosterProjectSync.shared.schedule(listing) }
    }

    private func refreshUploads() async {
        let owner = StudioAuth.shared.account?.userID
        do {
            let list: PosterContentList = try await PosterHTTP.get("api/content?surface=poster")
            guard owner == StudioAuth.shared.account?.userID else { return }
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
