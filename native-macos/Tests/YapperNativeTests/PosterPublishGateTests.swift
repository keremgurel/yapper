import Foundation
import Testing
@testable import YapperNative

/// One press publishes to everything chosen, so the button only opens when
/// every chosen destination can go, the same rule as the web's inline publish.
@Suite
struct PosterPublishGateTests {
    private let youtubeCaption = PosterCaption(platform: "youtube", title: "How I edit", body: "Body", hashtags: [])
    private let instagramCaption = PosterCaption(platform: "instagram", title: "", body: "Body", hashtags: [])

    private func ready(_ platform: PublishPlatform, _ caption: PosterCaption, outcome: PosterOutcome? = nil) -> PosterReadiness {
        PosterReadiness(platform: platform, connected: true, caption: caption, hasCover: false, outcome: outcome)
    }

    private func gate(_ remaining: [PublishPlatform], _ readiness: [PosterReadiness], youtube: PosterYouTubeSettings = .init(),
                      description: String = "Body", tiktokReady: Bool = true, videoReady: Bool = true) -> PosterPublishGate {
        PosterPublishGate(remaining: remaining, readiness: readiness, publishable: PublishPlatform.enabledCases,
                          videoReady: videoReady, youtube: youtube, youtubeDescription: description, tiktokReady: tiktokReady)
    }

    @Test func opensOnlyWhenEveryChosenDestinationIsReady() {
        let missingTitle = PosterCaption(platform: "youtube", title: "", body: "Body", hashtags: [])
        #expect(gate([.youtube, .instagram], [ready(.youtube, youtubeCaption), ready(.instagram, instagramCaption)]).canSend)
        // A YouTube card without a title blocks the whole press instead of
        // posting to Instagram alone.
        let blocked = gate([.youtube, .instagram], [ready(.youtube, missingTitle), ready(.instagram, instagramCaption)])
        #expect(!blocked.canSend && blocked.waiting == [.youtube])
        #expect(!gate([], []).canSend)
        #expect(!gate([.instagram], [ready(.instagram, instagramCaption)], videoReady: false).canSend)
    }

    @Test func aDisconnectedChoiceBlocksRatherThanShrinking() {
        let gate = PosterPublishGate(remaining: [.youtube, .instagram], readiness: [ready(.youtube, youtubeCaption), ready(.instagram, instagramCaption)],
                                     publishable: [.youtube], videoReady: true, youtube: .init(), youtubeDescription: "Body", tiktokReady: true)
        #expect(!gate.canSend)
    }

    @Test func youtubeNeedsAnAudienceAndADescriptionItAccepts() {
        var undeclared = PosterYouTubeSettings()
        undeclared.madeForKids = nil
        #expect(!gate([.youtube], [ready(.youtube, youtubeCaption)], youtube: undeclared).canSend)
        let long = gate([.youtube], [ready(.youtube, youtubeCaption)], description: String(repeating: "🎬", count: 1251))
        #expect(!long.canSend && long.youtubeDescriptionTooLong)
    }

    @Test func tiktokWaitsForItsSettings() {
        let caption = PosterCaption(platform: "tiktok", title: "", body: "Body", hashtags: [])
        let waiting = gate([.tiktok], [ready(.tiktok, caption)], tiktokReady: false)
        #expect(!waiting.canSend && waiting.waiting == [.tiktok])
        #expect(gate([.tiktok], [ready(.tiktok, caption)], tiktokReady: true).canSend)
    }

    @Test func aFailedDestinationCanBeSentAgain() {
        let failed = PosterOutcome(videoID: "v", videoTitle: "Video", platform: .instagram, status: .failed, error: "publish_failed")
        #expect(gate([.instagram], [ready(.instagram, instagramCaption, outcome: failed)]).canSend)
    }

    @Test func quickTimesSkipSaturdayWhenItIsTomorrow() throws {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = try #require(TimeZone(identifier: "America/Toronto"))
        let friday = try #require(calendar.date(from: DateComponents(year: 2026, month: 10, day: 30, hour: 15)))
        #expect(PosterQuickTimes.options(from: friday, calendar: calendar).map(\.label) == ["Tomorrow, 9:00 AM", "Tomorrow, 6:00 PM"])
        let tuesday = try #require(calendar.date(from: DateComponents(year: 2026, month: 10, day: 27, hour: 15)))
        let options = PosterQuickTimes.options(from: tuesday, calendar: calendar)
        #expect(options.count == 3)
        #expect(calendar.component(.weekday, from: options[2].date) == 7 && calendar.component(.hour, from: options[2].date) == 10)
        #expect(calendar.component(.hour, from: options[0].date) == 9 && calendar.isDate(options[0].date, inSameDayAs: tuesday.addingTimeInterval(86_400)))
    }

    @Test func tiktokDefaultsToEveryoneOnlyOnceApproved() {
        func context(audited: Bool, options: [String]) -> PosterTikTokContext {
            PosterTikTokContext(creator: PosterTikTokCreator(
                creator_nickname: "Kerem", creator_username: "kerem", creator_avatar_url: nil, privacy_level_options: options,
                comment_disabled: false, duet_disabled: false, stitch_disabled: false, max_video_post_duration_sec: 600
            ), accountId: "a", audited: audited)
        }
        let all = ["PUBLIC_TO_EVERYONE", "FOLLOWER_OF_CREATOR", "SELF_ONLY"]
        #expect(PosterTikTokReviewModel.defaultPrivacy(context(audited: true, options: all)) == "PUBLIC_TO_EVERYONE")
        #expect(PosterTikTokReviewModel.defaultPrivacy(context(audited: false, options: all)) == "SELF_ONLY")
        #expect(PosterTikTokReviewModel.defaultPrivacy(context(audited: true, options: ["FOLLOWER_OF_CREATOR"])).isEmpty)
    }
}
