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
    struct Day: Identifiable {
        let date: Date
        let groups: [HomeVideoGroup]
        var id: Date { date }
    }
    let days: [Day]
    let groups: [HomeVideoGroup]
    let totalViews: Int
    let postCount: Int
    let average: Int
    let thisWeek: Int
    let channels: [Channel]

    init(videos: [HomeRankedVideo], connected: [PublishPlatform], now: Date) {
        let recent = videos.filter { post in
            guard let date = post.video.publishedDate else { return false }
            return date >= now.addingTimeInterval(-30 * 86400) && date <= now
        }
        groups = HomeVideoGrouping.groups(recent)
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        let start = calendar.startOfDay(for: now.addingTimeInterval(-30 * 86400))
        let grouped = groups
        days = (0...30).map { index in
            let date = start.addingTimeInterval(Double(index) * 86400)
            return Day(date: date, groups: grouped.filter { group in
                guard let published = IdeaDates.parse(group.publishedAt) else { return false }
                return calendar.isDate(published, inSameDayAs: date)
            })
        }
        let posts = groups.flatMap(\.posts)
        totalViews = groups.reduce(0) { $0 + $1.views }
        postCount = posts.count
        average = groups.isEmpty ? 0 : Int((Double(totalViews) / Double(groups.count)).rounded())
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
