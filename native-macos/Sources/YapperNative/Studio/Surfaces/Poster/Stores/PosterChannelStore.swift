import Foundation

/// Each connected channel's own posts, cached per platform so flipping
/// between source tabs is instant after the first visit.
@MainActor
final class PosterChannelStore: ObservableObject {
    static let shared = PosterChannelStore()

    @Published private(set) var lists: [PublishPlatform: PosterPlatformVideos] = [:]
    @Published private(set) var failed: Set<PublishPlatform> = []
    private var fetchedAt: [PublishPlatform: Date] = [:]

    func videos(for platform: PublishPlatform) -> [PosterVideo] {
        (lists[platform]?.videos ?? [])
            .sorted { $0.publishedAt > $1.publishedAt }
            .map { PosterVideo(platform: platform, video: $0) }
    }

    func loading(_ platform: PublishPlatform) -> Bool { lists[platform] == nil && !failed.contains(platform) }
    func connected(_ platform: PublishPlatform) -> Bool { lists[platform]?.connected ?? false }

    /// Refreshes when the cached list is older than a minute, or when forced.
    func refresh(_ platform: PublishPlatform, force: Bool = false) async {
        if !force, let at = fetchedAt[platform], Date().timeIntervalSince(at) < 60 { return }
        do {
            let list: PosterPlatformVideos = try await PosterHTTP.get("api/publish/\(platform.rawValue)/videos")
            lists[platform] = list
            fetchedAt[platform] = Date()
            failed.remove(platform)
        } catch {
            if lists[platform] == nil || force { failed.insert(platform) }
        }
    }
}
