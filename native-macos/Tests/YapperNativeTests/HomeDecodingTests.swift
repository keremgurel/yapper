import Foundation
import Testing
@testable import YapperNative

/// Home's shapes and the pure rules it shares with the web Home. The stats
/// cases are the web's `channel-stats.test.ts`, so both apps agree.
@Suite
struct HomeDecodingTests {
    private static let now = ISO8601DateFormatter().date(from: "2026-10-10T12:00:00Z")!
    private static let day: TimeInterval = 86_400

    private func decode<T: Decodable>(_ json: String, as type: T.Type) throws -> T {
        try StudioJSONClient.decoder.decode(T.self, from: Data(json.utf8))
    }

    private func post(_ daysAgo: Double, _ views: Int, _ platform: PublishPlatform = .youtube) -> HomeRankedVideo {
        let published = Self.now.addingTimeInterval(-daysAgo * Self.day)
        return HomeRankedVideo(platform: platform, video: HomeVideo(
            id: "\(platform.rawValue)-\(daysAgo)-\(views)",
            title: "",
            thumbnail: nil,
            viewCount: views,
            publishedAt: ISO8601DateFormatter().string(from: published),
            url: ""
        ))
    }

    private func idea(_ id: String, _ status: String, scheduled: String? = nil, updated: String) throws -> IdeaItem {
        let scheduledJSON = scheduled.map { "\"\($0)\"" } ?? "null"
        return try decode("""
        {"id":"\(id)","title":"\(id)","status":"\(status)","stage":"bank","formats":[],"scheduledFor":\(scheduledJSON),
         "originalNote":"","updatedAt":"\(updated)","createdAt":"\(updated)"}
        """, as: IdeaItem.self)
    }

    @Test func decodesVideosWithMissingFields() throws {
        let json = """
        {"connected":true,"videos":[
        {"id":"v1","title":"How I edit","thumbnail":"https://i.ytimg.com/vi/v1/hq.jpg","viewCount":12840,
         "publishedAt":"2026-09-01T00:00:00Z","privacyStatus":"public","url":"https://youtube.com/shorts/v1","durationSec":42},
        {"id":"v2","title":"","caption":"A caption","thumbnail":null,"publishedAt":"2026-09-02T00:00:00.000Z",
         "privacyStatus":"public","url":"https://tiktok.com/@me/video/v2","mediaKey":"u/k","sourcePlatform":"instagram"}]}
        """
        let response = try decode(json, as: HomeVideosResponse.self)
        #expect(response.connected)
        #expect(response.videos[0].viewCount == 12840)
        #expect(response.videos[0].publishedDate != nil)
        #expect(response.videos[1].viewCount == 0)
        #expect(response.videos[1].displayTitle == "A caption")
        #expect(response.videos[1].publishedDate != nil)
    }

    @Test func typicalIsTheMedian() {
        #expect(HomeChannelMath.typicalViews([post(1, 100), post(2, 200), post(3, 90_000)]) == 200)
        #expect(HomeChannelMath.typicalViews([post(1, 100), post(2, 300)]) == 200)
        #expect(HomeChannelMath.typicalViews([]) == 0)
        #expect(HomeChannelMath.versusUsual(600, typical: 200) == 3)
        #expect(HomeChannelMath.versusUsual(600, typical: 0) == nil)
    }

    @Test func weeklyPostsCountsRollingWeeks() {
        let weeks = HomeChannelMath.weeklyPosts([post(1, 1), post(2, 1), post(9, 1)], now: Self.now, weeks: 3)
        #expect(weeks == [0, 1, 2])
    }

    @Test func statsMatchTheWeb() {
        let stats = HomeChannelMath.stats([
            post(5, 1_000, .tiktok),
            post(20, 500),
            post(40, 750),
            post(45, 750, .instagram),
            post(200, 10_000),
        ], now: Self.now)
        #expect(stats.totalViews == 13_000)
        #expect(stats.postCount == 5)
        #expect(stats.recentViews == 1_500)
        #expect(abs(stats.recentChange ?? 1) < 0.0001)
        #expect(stats.postsThisWeek == 1)
        #expect(stats.platforms.map(\.platform) == [.youtube, .tiktok, .instagram])
        #expect(HomeChannelMath.stats([post(3, 100)], now: Self.now).recentChange == nil)
    }

    @Test func oneFailedChannelKeepsTheOthers() {
        let ok = HomeChannel(platform: .youtube, connected: true, videos: [], failed: false)
        let broken = HomeChannel(platform: .tiktok, connected: false, videos: [], failed: true)
        let idle = HomeChannel(platform: .facebook, connected: false, videos: [], failed: false)
        #expect(!HomeChannelHealth.allFailed([ok, broken, idle]))
        #expect(HomeChannelHealth.allFailed([broken, idle]))
        #expect(HomeChannelHealth.names([.tiktok]) == "TikTok")
        #expect(HomeChannelHealth.names([.instagram, .tiktok, .youtube]) == "Instagram, TikTok and YouTube")
    }

    @Test func setupOnlyShowsOnceEverythingIsKnown() throws {
        let item = try idea("a", "captured", updated: "2026-10-01T00:00:00Z")
        let unknown = HomeDashboard(channels: nil, connections: nil, connectionsFailed: false, items: [item], brainStarted: nil, now: Self.now)
        #expect(unknown.setup == nil)
        let known = HomeDashboard(channels: [], connections: [], connectionsFailed: false, items: [item], brainStarted: false, now: Self.now)
        #expect(known.setup?.map(\.done) == [true, false, false])
        #expect(known.channels == nil)
    }

    @Test func upNextPutsDatedWorkFirstAndDropsPosted() throws {
        let queue = HomeRanking.upNext([
            try idea("old", "drafting", updated: "2026-09-01T00:00:00Z"),
            try idea("posted", "posted", updated: "2026-09-30T00:00:00Z"),
            try idea("late", "ready", scheduled: "2026-10-20T00:00:00Z", updated: "2026-09-02T00:00:00Z"),
            try idea("soon", "ready", scheduled: "2026-10-12T00:00:00Z", updated: "2026-09-03T00:00:00Z"),
            try idea("new", "captured", updated: "2026-09-29T00:00:00Z"),
        ])
        #expect(queue.map(\.id) == ["soon", "late", "new", "old"])
    }

    @Test func greetingFollowsTheHour() {
        #expect(HomeGreeting.text(hour: 9, firstName: "Kerem") == "Good morning, Kerem")
        #expect(HomeGreeting.text(hour: 14, firstName: nil) == "Good afternoon")
        #expect(HomeGreeting.text(hour: 23, firstName: " ") == "Working late")
    }

    @Test func compactNumbers() {
        #expect(HomeNumber.compact(999) == 999.formatted(.number))
        #expect(HomeNumber.compact(1_234).hasSuffix("K"))
        #expect(HomeNumber.multiplier(3.24) == "3.2×")
        #expect(HomeNumber.multiplier(12.4) == "12×")
    }
}
