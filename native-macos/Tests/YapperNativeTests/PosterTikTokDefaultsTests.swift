import Foundation
import Testing
@testable import YapperNative

/// A Direct Post starts filled in: the widest audience and every interaction
/// the account allows. Only the posting declaration is left to the creator.
@Suite
struct PosterTikTokDefaultsTests {
    private func context(
        audited: Bool = true, account: String = "a",
        options: [String] = ["PUBLIC_TO_EVERYONE", "MUTUAL_FOLLOW_FRIENDS", "SELF_ONLY"],
        comments: Bool = true, duet: Bool = true, stitch: Bool = true
    ) -> PosterTikTokContext {
        PosterTikTokContext(creator: PosterTikTokCreator(
            creator_nickname: "Kerem", creator_username: "kerem", creator_avatar_url: nil, privacy_level_options: options,
            comment_disabled: !comments, duet_disabled: !duet, stitch_disabled: !stitch, max_video_post_duration_sec: 600
        ), accountId: account, audited: audited)
    }

    @Test func aPublicAccountStartsOpenToEveryone() {
        let settings = PosterTikTokSettings.defaults(for: context())
        #expect(settings.privacy == "PUBLIC_TO_EVERYONE" && settings.accountId == "a")
        #expect(settings.allowComment && settings.allowDuet && settings.allowStitch)
        #expect(!settings.discloseCommercial && !settings.ownBrand && !settings.brandedContent && !settings.aiGenerated)
        #expect(!settings.consent)
    }

    @Test func aPrivateAccountStartsWithItsFollowers() {
        let offered = ["SELF_ONLY", "MUTUAL_FOLLOW_FRIENDS", "FOLLOWER_OF_CREATOR"]
        #expect(PosterTikTokSettings.defaults(for: context(options: offered)).privacy == "FOLLOWER_OF_CREATOR")
        #expect(PosterTikTokSettings.defaults(for: context(options: ["SELF_ONLY", "MUTUAL_FOLLOW_FRIENDS"])).privacy == "MUTUAL_FOLLOW_FRIENDS")
    }

    @Test func beforeTheAuditOnlyMeIsTheOnlyAudience() {
        let unaudited = context(audited: false)
        #expect(PosterTikTokSettings.audiences(for: unaudited) == ["SELF_ONLY"])
        #expect(PosterTikTokSettings.defaults(for: unaudited).privacy == "SELF_ONLY")
        // An account that offers no audience at all leaves the choice empty.
        #expect(PosterTikTokSettings.defaults(for: context(audited: false, options: ["PUBLIC_TO_EVERYONE"])).privacy.isEmpty)
    }

    @Test func interactionsTheAccountTurnedOffStayOff() {
        let settings = PosterTikTokSettings.defaults(for: context(comments: false, stitch: false))
        #expect(!settings.allowComment && settings.allowDuet && !settings.allowStitch)
    }

    @Test func defaultsPassEveryCheckButTheDeclaration() {
        let context = context()
        var settings = PosterTikTokSettings.defaults(for: context)
        #expect(settings.problem(creator: context.creator, duration: 30, audited: true) == "consent_required")
        #expect(settings.problemBesidesConsent(creator: context.creator, duration: 30, audited: true) == nil)
        settings.discloseCommercial = true
        #expect(settings.problemBesidesConsent(creator: context.creator, duration: 30, audited: true) == "commercial_disclosure_required")
        #expect(!settings.consent)
    }

    @Test @MainActor func aReloadKeepsWhatTheCreatorChose() {
        let model = PosterTikTokReviewModel()
        model.applyCreator(context())
        #expect(model.settings.privacy == "PUBLIC_TO_EVERYONE" && model.settings.allowDuet)
        model.settings.privacy = "MUTUAL_FOLLOW_FRIENDS"
        model.settings.allowDuet = false
        model.settings.aiGenerated = true
        model.settings.consent = true
        model.applyCreator(context())
        #expect(model.settings.privacy == "MUTUAL_FOLLOW_FRIENDS" && !model.settings.allowDuet)
        #expect(model.settings.aiGenerated && model.settings.consent)
    }

    @Test @MainActor func aReloadDropsOnlyWhatTheAccountNoLongerAllows() {
        let model = PosterTikTokReviewModel()
        model.applyCreator(context())
        model.settings.consent = true
        model.applyCreator(context(comments: false))
        #expect(!model.settings.allowComment && model.settings.allowStitch && model.settings.consent)
        // Losing the chosen audience falls back to one the account offers and
        // asks for the declaration again.
        model.applyCreator(context(audited: false))
        #expect(model.settings.privacy == "SELF_ONLY" && !model.settings.consent)
        #expect(model.privacyOptions == ["SELF_ONLY"])
    }

    @Test @MainActor func anotherAccountStartsFromItsOwnDefaults() {
        let model = PosterTikTokReviewModel()
        model.applyCreator(context())
        model.settings.privacy = "SELF_ONLY"
        model.settings.allowComment = false
        model.settings.consent = true
        model.applyCreator(context(account: "b"))
        #expect(model.settings == PosterTikTokSettings.defaults(for: context(account: "b")))
    }

    @Test @MainActor func theSummaryWaitsForTheAccountAndTheLengthNotTheBox() {
        let model = PosterTikTokReviewModel()
        #expect(model.standing == .checking && !model.awaitsConsentOnly)
        model.applyCreator(context())
        #expect(model.standing == .checking)
        model.applyDuration(42)
        #expect(model.standing == .set && model.awaitsConsentOnly)
        #expect(!model.review(caption: "Body").ready)
        model.settings.consent = true
        #expect(model.standing == .set && !model.awaitsConsentOnly)
        #expect(model.review(caption: "Body").ready)
        // A video longer than the account allows is a real problem.
        model.applyDuration(900)
        #expect(model.standing == .needsReview && !model.awaitsConsentOnly)
        // The inbox route needs neither the account's options nor the box.
        model.mode = .inbox
        #expect(model.standing == .set && !model.awaitsConsentOnly)
    }
}
