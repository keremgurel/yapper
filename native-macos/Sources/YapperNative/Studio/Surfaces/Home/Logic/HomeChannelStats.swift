import Foundation

/// The numbers card's figures. Computed exactly as the web's
/// `channel-stats.ts` does, so both apps show the same numbers.
struct HomeChannelStats: Equatable {
    struct Share: Equatable {
        let platform: PublishPlatform
        let views: Int
    }

    let totalViews: Int
    let postCount: Int
    /// Views on the middle post.
    let typical: Int
    /// Views on posts published in the last 30 days.
    let recentViews: Int
    /// Change against posts from the 30 days before, or nil with nothing to
    /// compare against. Views are lifetime counts, so this compares batches of
    /// posts, not daily growth.
    let recentChange: Double?
    let postsThisWeek: Int
    /// Rounded average of the eleven weeks before this one.
    let usualPerWeek: Int
    /// Each platform's share of all views, largest first.
    let platforms: [Share]
}

enum HomeChannelMath {
    private static let day: TimeInterval = 86_400
    private static let week: TimeInterval = 7 * day

    static func stats(_ videos: [HomeRankedVideo], now: Date) -> HomeChannelStats {
        let recent = sumViews(publishedBetween(videos, from: now.addingTimeInterval(-30 * day), to: now.addingTimeInterval(0.001)))
        let previous = sumViews(publishedBetween(videos, from: now.addingTimeInterval(-60 * day), to: now.addingTimeInterval(-30 * day)))
        let weeks = weeklyPosts(videos, now: now)
        let earlier = weeks.dropLast()
        var byPlatform: [PublishPlatform: Int] = [:]
        for video in videos { byPlatform[video.platform, default: 0] += video.video.viewCount }

        return HomeChannelStats(
            totalViews: sumViews(videos),
            postCount: videos.count,
            typical: typicalViews(videos),
            recentViews: recent,
            recentChange: previous > 0 ? Double(recent) / Double(previous) - 1 : nil,
            postsThisWeek: weeks.last ?? 0,
            usualPerWeek: earlier.isEmpty ? 0 : Int((Double(earlier.reduce(0, +)) / Double(earlier.count)).rounded()),
            platforms: byPlatform
                .filter { $0.value > 0 }
                .map { HomeChannelStats.Share(platform: $0.key, views: $0.value) }
                .sorted { $0.views > $1.views }
        )
    }

    /// The middle post's views: what a normal post does, which one viral hit
    /// cannot drag up the way it drags an average.
    static func typicalViews(_ videos: [HomeRankedVideo]) -> Int {
        guard !videos.isEmpty else { return 0 }
        let sorted = videos.map(\.video.viewCount).sorted()
        let middle = sorted.count / 2
        return sorted.count % 2 == 1
            ? sorted[middle]
            : Int((Double(sorted[middle - 1] + sorted[middle]) / 2).rounded())
    }

    /// How a post did against the typical post, or nil with nothing to compare.
    static func versusUsual(_ views: Int, typical: Int) -> Double? {
        typical > 0 ? Double(views) / Double(typical) : nil
    }

    /// Posts per rolling week, oldest first; the last entry is the past 7 days.
    static func weeklyPosts(_ videos: [HomeRankedVideo], now: Date, weeks: Int = 12) -> [Int] {
        (0..<weeks).map { index in
            let end = now.addingTimeInterval(-Double(weeks - 1 - index) * week)
            return publishedBetween(videos, from: end.addingTimeInterval(-week), to: end).count
        }
    }

    private static func publishedBetween(_ videos: [HomeRankedVideo], from: Date, to: Date) -> [HomeRankedVideo] {
        videos.filter { video in
            guard let at = video.video.publishedDate else { return false }
            return at >= from && at < to
        }
    }

    private static func sumViews(_ videos: [HomeRankedVideo]) -> Int {
        videos.reduce(0) { $0 + $1.video.viewCount }
    }
}
