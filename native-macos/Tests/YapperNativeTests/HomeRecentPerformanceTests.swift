import Foundation
import Testing
@testable import YapperNative
@Suite struct HomeRecentPerformanceTests {
    private let now = ISO8601DateFormatter().date(from: "2026-10-15T12:00:00Z")!
    private func post(_ id: String, _ platform: PublishPlatform, _ days: Double, _ views: Int, _ title: String = "Building apps to $10K MRR episode 14", source: String? = nil) -> HomeRankedVideo {
        HomeRankedVideo(platform: platform, video: HomeVideo(id: id, title: title, mediaKey: source, thumbnail: nil, viewCount: views, publishedAt: ISO8601DateFormatter().string(from: now.addingTimeInterval(-days*86400)), url: ""))
    }
    @Test func groupsCountsAndSeparatesChannelContributions() {
        let data = HomeRecentPerformance(videos: [post("1", .youtube, 2, 100), post("2", .instagram, 2, 300), post("3", .youtube, 20, 600, "Another useful distinct video")], connected: [.youtube, .instagram, .tiktok], now: now)
        #expect(data.groups.count == 2)
        #expect(data.totalViews == 1000)
        #expect(data.postCount == 3)
        #expect(data.average == 500)
        #expect(data.thisWeek == 1)
        #expect(data.channels.first { $0.platform == .tiktok }?.posts == 0)
    }
    @Test func filtersBeforeGroupingAndExcludesFuturePosts() {
        let data = HomeRecentPerformance(videos: [post("1", .youtube, 31, 9000, source: "same"), post("2", .instagram, 1, 100, source: "same"), post("future", .youtube, -1, 800)], connected: [], now: now)
        #expect(data.totalViews == 100)
        #expect(data.groups.count == 1)
        #expect(data.postCount == 1)
    }
    @Test func averagesUniqueVideosAndBucketsWithoutDoubleCounting() {
        let data = HomeRecentPerformance(videos: [post("a", .youtube, 2, 100), post("b", .instagram, 2, 200), post("c", .youtube, 3, 600, "Another distinct video title"), post("d", .youtube, 30, 2100, "A third distinct video title")], connected: [.youtube, .instagram], now: now)
        #expect(data.average == 1000)
        #expect(data.days.count == 31)
        #expect(data.days.flatMap(\.groups).count == 3)
        #expect(data.days.flatMap(\.groups).reduce(0) { $0 + $1.views } == data.totalViews)
    }
}
