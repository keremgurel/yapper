import Foundation
import Testing
@testable import YapperNative

@Suite struct HomeOpportunitiesTests {
    private let now = ISO8601DateFormatter().date(from: "2026-10-15T12:00:00Z")!
    private func post(_ id: String, _ platform: PublishPlatform, days: Double = 4, views: Int = 200, title: String = "Building apps to $10K MRR episode 14", source: String? = nil) -> HomeRankedVideo {
        HomeRankedVideo(platform: platform, video: HomeVideo(id: id, title: title, mediaKey: source, thumbnail: nil, viewCount: views, publishedAt: ISO8601DateFormatter().string(from: now.addingTimeInterval(-days * 86400)), url: "https://example.com/\(id)"))
    }
    @Test func groupsCrossPostsButKeepsDifferentEpisodes() {
        let groups = HomeOpportunities.groups([
            post("yt", .youtube), post("ig", .instagram, views: 300, title: "Building apps to $10K MRR episode 14! #buildinpublic"),
            post("tt", .tiktok, views: 10), post("old", .tiktok, title: "Building apps to $10K MRR episode 13"), post("repeat", .youtube)
        ])
        #expect(groups.count == 3)
        #expect(groups[0].views == 510)
        #expect(groups[0].posts.count == 3)
        #expect(HomeOpportunities.groups([post("a", .youtube, title: "Untitled"), post("b", .instagram, title: "Untitled")]).count == 2)
    }
    @Test func savedSourcesAreAuthoritative() {
        #expect(HomeOpportunities.groups([post("a", .youtube, source: "one"), post("b", .instagram, source: "two")]).count == 2)
        #expect(HomeOpportunities.groups([post("a", .youtube, source: "one"), post("b", .instagram, days: 100, title: "Different caption", source: "one")]).count == 1)
    }
    @Test func usesMatureSameChannelBaselineWithoutRepeatingAGroup() {
        let baseline = (0..<5).map { post("base\($0)", .youtube, days: Double(10 + $0), views: 100, title: "Different useful idea \($0)") }
        let videos = baseline + [post("winner", .youtube, views: 1000), post("other", .instagram, title: "Another useful recent video")]
        let suggestions = HomeOpportunities.suggestions(HomeOpportunities.groups(videos), videos: videos, connected: [.youtube, .instagram], now: now)
        #expect(suggestions[0].kind == .followUp)
        #expect(suggestions[0].comparison?.times == 10)
        #expect(Set(suggestions.map { $0.group.id }).count == suggestions.count)
    }
    @Test func rotatesAndIgnoresFreshUploads() {
        let videos = [post("a", .youtube), post("b", .youtube, title: "Another useful recent video")]
        let groups = HomeOpportunities.groups(videos)
        let first = HomeOpportunities.suggestions(groups, videos: videos, connected: [.youtube, .instagram], now: now)
        let next = HomeOpportunities.suggestions(groups, videos: videos, connected: [.youtube, .instagram], now: now, rotation: 1)
        #expect(first[0].id != next[0].id)
        let fresh = [post("new", .youtube, days: 0.2, views: 10000)]
        #expect(HomeOpportunities.suggestions(HomeOpportunities.groups(fresh), videos: fresh, connected: [.youtube, .instagram], now: now).isEmpty)
    }
}
