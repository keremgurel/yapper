import Foundation
import Testing
@testable import YapperNative

@Suite struct HomeVideoGroupingTests {
    private let now = ISO8601DateFormatter().date(from: "2026-10-15T12:00:00Z")!
    private func post(_ id: String, _ platform: PublishPlatform, days: Double = 4, views: Int = 200, title: String = "Building apps to $10K MRR episode 14", source: String? = nil) -> HomeRankedVideo {
        HomeRankedVideo(platform: platform, video: HomeVideo(id: id, title: title, mediaKey: source, thumbnail: nil, viewCount: views, publishedAt: ISO8601DateFormatter().string(from: now.addingTimeInterval(-days * 86400)), url: "https://example.com/\(id)"))
    }
    @Test func groupsCrossPostsButKeepsDifferentEpisodes() {
        let groups = HomeVideoGrouping.groups([
            post("yt", .youtube), post("ig", .instagram, views: 300, title: "Building apps to $10K MRR episode 14! #buildinpublic"),
            post("tt", .tiktok, views: 10), post("old", .tiktok, title: "Building apps to $10K MRR episode 13"), post("repeat", .youtube)
        ])
        #expect(groups.count == 3)
        #expect(groups[0].views == 510)
        #expect(groups[0].posts.count == 3)
        #expect(HomeVideoGrouping.groups([post("a", .youtube, title: "Untitled"), post("b", .instagram, title: "Untitled")]).count == 2)
    }
    @Test func captionOnlyPostsCannotBridgeConflictingSources() {
        #expect(HomeVideoGrouping.groups([
            post("a", .youtube, views: 300, source: "one"),
            post("b", .instagram, views: 200),
            post("c", .tiktok, views: 100, source: "two")
        ]).count == 2)
    }
    @Test func savedSourcesAreAuthoritative() {
        #expect(HomeVideoGrouping.groups([post("a", .youtube, source: "one"), post("b", .instagram, source: "two")]).count == 2)
        #expect(HomeVideoGrouping.groups([post("a", .youtube, source: "one"), post("b", .instagram, days: 100, title: "Different caption", source: "one")]).count == 1)
    }
}
