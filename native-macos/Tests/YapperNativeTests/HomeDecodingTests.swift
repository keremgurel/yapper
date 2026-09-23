import Foundation
import Testing
@testable import YapperNative

/// Home reads four routes; these pin the shapes it decodes and the pure
/// rules it shares with the web Home.
@Suite
struct HomeDecodingTests {
    private func decode<T: Decodable>(_ json: String, as type: T.Type) throws -> T {
        try StudioJSONClient.decoder.decode(T.self, from: Data(json.utf8))
    }

    @Test func decodesContentList() throws {
        let json = """
        {"items":[{"id":"c1","title":"","status":"ready","stage":"library","formats":["short"],
        "ideaType":null,"scheduledFor":"2026-09-25T15:00:00.000Z","submissionId":null,"pillar":null,
        "pillarId":null,"sourceUrl":null,"sourceTitle":"A reference","sourcePlatform":null,
        "transcriptStatus":null,"script":null,"originalNote":"note","updatedAt":"2026-09-20T10:00:00.000Z",
        "createdAt":"2026-09-19T10:00:00.000Z"},
        {"id":"c2","title":"Hook ideas","status":"drafting","stage":"bank","formats":[],"ideaType":"talking_head",
        "scheduledFor":null,"submissionId":null,"pillar":"Tips","pillarId":"p1","sourceUrl":null,"sourceTitle":null,
        "sourcePlatform":null,"transcriptStatus":null,"script":null,"originalNote":"","updatedAt":"2026-09-22T10:00:00.000Z",
        "createdAt":"2026-09-21T10:00:00.000Z"}]}
        """
        let items = try decode(json, as: HomeItemsResponse.self).items
        #expect(items.count == 2)
        #expect(items[0].displayTitle == "A reference")
        #expect(items[0].isDated)
        #expect(items[1].displayTitle == "Hook ideas")
        #expect(HomeUpNextSection.scheduledLabel(items[0].scheduledFor) != nil)
    }

    @Test func decodesVideosWithMissingFields() throws {
        let json = """
        {"connected":true,"videos":[
        {"id":"v1","title":"How I edit","thumbnail":"https://i.ytimg.com/vi/v1/hq.jpg","viewCount":12840,
         "publishedAt":"2026-09-01T00:00:00Z","privacyStatus":"public","url":"https://youtube.com/shorts/v1","durationSec":42},
        {"id":"v2","title":"No views field","thumbnail":null,"publishedAt":"2026-09-02T00:00:00Z",
         "privacyStatus":"public","url":"https://tiktok.com/@me/video/v2","mediaKey":"u/k","sourcePlatform":"instagram"}]}
        """
        let response = try decode(json, as: HomeVideosResponse.self)
        #expect(response.connected)
        #expect(response.videos[0].viewCount == 12840)
        #expect(response.videos[1].viewCount == 0)
        #expect(response.videos[1].thumbnail == nil)
    }

    @Test func decodesDisconnectedChannelAndCreatedIdea() throws {
        let empty = try decode(#"{"connected":false,"videos":[]}"#, as: HomeVideosResponse.self)
        #expect(!empty.connected && empty.videos.isEmpty)
        let created = try decode(#"{"item":{"id":"new1","title":"","status":"captured","originalNote":"x"}}"#, as: HomeCreatedIdea.self)
        #expect(created.item.id == "new1")
    }

    @Test func upNextPutsDatedWorkFirstAndDropsPosted() {
        func item(_ id: String, _ status: String, scheduled: String? = nil, updated: String) -> HomeItem {
            HomeItem(id: id, title: id, status: status, scheduledFor: scheduled, sourceTitle: nil, originalNote: "", updatedAt: updated)
        }
        let queue = HomeRanking.upNext([
            item("old", "drafting", updated: "2026-09-01"),
            item("posted", "posted", updated: "2026-09-30"),
            item("later", "ready", scheduled: "2026-10-02", updated: "2026-09-01"),
            item("soon", "ready", scheduled: "2026-09-25", updated: "2026-09-01"),
            item("fresh", "captured", updated: "2026-09-22"),
        ])
        #expect(queue.map(\.id) == ["soon", "later", "fresh", "old"])
    }

    @Test func dailyIdeasFillToFiveWithoutDuplicates() {
        let saved = [HomeItem(id: "s1", title: "My saved idea", status: "captured", scheduledFor: nil, sourceTitle: nil, originalNote: "", updatedAt: "")]
        let top = HomeRankedVideo(platform: .youtube, video: HomeVideo(id: "v", title: "Top", thumbnail: nil, viewCount: 9, url: ""))
        let ideas = HomeDailyIdeas.make(saved: saved, topVideo: top)
        #expect(ideas.count == 5)
        #expect(ideas[0].itemID == "s1")
        #expect(ideas[1].title.contains("Top"))
        #expect(Set(ideas.map(\.title)).count == 5)
    }

    @Test func compactNumbers() {
        #expect(HomeNumber.compact(999) == 999.formatted(.number))
        #expect(HomeNumber.compact(1_234).hasSuffix("K"))
    }
}
