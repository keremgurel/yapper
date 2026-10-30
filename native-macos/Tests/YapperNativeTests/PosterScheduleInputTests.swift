import Foundation
import Testing
@testable import YapperNative

/// A scheduled post saves what a post now would send, TikTok included: the
/// reviewed Direct Post caption and settings, or nothing extra for a draft.
@MainActor
@Suite
struct PosterScheduleInputTests {
    private let target = PosterPublishTarget(
        id: "v1", title: "ACL update", fallbackTitle: "ACL update",
        captions: [
            .tiktok: PosterCaption(platform: "tiktok", title: "", body: "Month one of rehab", hashtags: ["acl"]),
            .youtube: PosterCaption(platform: "youtube", title: "One month after ACL surgery", body: "Week by week", hashtags: []),
        ],
        submissionID: "s1", mediaKey: nil, contentItemID: "c1", thumbnailKey: "users/u/thumbnails/t.jpg"
    )

    private func review(_ mode: PosterTikTokReview.Mode) -> PosterTikTokReview {
        var settings = PosterTikTokSettings()
        settings.privacy = "SELF_ONLY"
        settings.allowComment = true
        settings.consent = true
        settings.accountId = "tt1"
        return PosterTikTokReview(mode: mode, caption: "Month one of rehab\n\n#acl", settings: settings, ready: true)
    }

    @Test func tiktokDirectSavesItsReviewedCaptionAndSettings() throws {
        let input = PosterScheduleModel.input(target, .tiktok, youtube: .init(), tiktok: review(.direct))
        #expect(input["submissionId"] as? String == "s1")
        #expect(input["caption"] as? String == "Month one of rehab\n\n#acl")
        let settings = try #require(input["settings"] as? [String: Any])
        #expect(settings["privacy"] as? String == "SELF_ONLY")
        #expect(settings["allowComment"] as? Bool == true && settings["consent"] as? Bool == true)
        #expect(settings["accountId"] as? String == "tt1")
    }

    @Test func tiktokInboxSavesNothingExtra() {
        let input = PosterScheduleModel.input(target, .tiktok, youtube: .init(), tiktok: review(.inbox))
        #expect(input["caption"] == nil && input["settings"] == nil)
        #expect(input["submissionId"] as? String == "s1")
    }

    @Test func youtubeKeepsItsTitleAndSettings() {
        let input = PosterScheduleModel.input(target, .youtube, youtube: .init(), tiktok: nil)
        #expect(input["title"] as? String == "One month after ACL surgery")
        #expect(input["description"] as? String == "Week by week")
        #expect(input["privacyStatus"] as? String == "public")
    }

    @Test func aRefusedScheduleStartsANewRequest() {
        #expect(PosterScheduleModel.notSaved("tiktok_privacy_invalid"))
        #expect(PosterScheduleModel.notSaved("invalid_body"))
        #expect(!PosterScheduleModel.notSaved("publish_failed"))
        #expect(!PosterScheduleModel.notSaved(nil))
    }
}
