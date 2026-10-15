import Foundation

/// Current lifetime views for posts published in the past 30 days. Filtering
/// precedes grouping, so a new cross-post cannot pull in an older copy's views.
struct HomeRecentPerformance {
    struct Channel: Identifiable {
        let platform: PublishPlatform
        let views: Int
        let posts: Int
        let typical: Int
        var id: PublishPlatform { platform }
    }
    let groups: [HomeVideoGroup]
    let totalViews: Int
    let postCount: Int
    let typical: Int
    let thisWeek: Int
    let channels: [Channel]

    init(videos: [HomeRankedVideo], connected: [PublishPlatform], now: Date) {
        let recent = videos.filter { post in
            guard let date = post.video.publishedDate else { return false }
            return date >= now.addingTimeInterval(-30 * 86400) && date <= now
        }
        groups = HomeVideoGrouping.groups(recent)
        let posts = groups.flatMap(\.posts)
        totalViews = groups.reduce(0) { $0 + $1.views }
        postCount = posts.count
        let counts = groups.map(\.views).sorted()
        let middle = counts.count / 2
        typical = counts.isEmpty ? 0 : counts.count.isMultiple(of: 2)
            ? Int((Double(counts[middle - 1] + counts[middle]) / 2).rounded()) : counts[middle]
        thisWeek = groups.filter { group in
            guard let date = IdeaDates.parse(group.publishedAt) else { return false }
            return date >= now.addingTimeInterval(-7 * 86400)
        }.count
        let platforms = PublishPlatform.enabledCases
        channels = platforms.compactMap { platform in
            let channel = posts.filter { $0.platform == platform }
            guard connected.contains(platform) || !channel.isEmpty else { return nil }
            return Channel(platform: platform, views: channel.reduce(0) { $0 + $1.video.viewCount }, posts: channel.count, typical: HomeChannelMath.typicalViews(channel))
        }.sorted { $0.views > $1.views }
    }
}
