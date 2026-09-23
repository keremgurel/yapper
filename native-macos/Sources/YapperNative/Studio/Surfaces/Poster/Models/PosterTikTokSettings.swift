import Foundation

/// TikTok Direct Post settings, the body `/api/publish/tiktok/direct` checks.
struct PosterTikTokSettings: Codable, Equatable {
    var privacy = ""
    var allowComment = false
    var allowDuet = false
    var allowStitch = false
    var discloseCommercial = false
    var ownBrand = false
    var brandedContent = false
    var aiGenerated = false
    var consent = false
    var accountId = ""

    static let privacyLabels: [String: String] = [
        "PUBLIC_TO_EVERYONE": "Everyone",
        "MUTUAL_FOLLOW_FRIENDS": "Friends",
        "FOLLOWER_OF_CREATOR": "Followers",
        "SELF_ONLY": "Only me",
    ]

    /// Mirrors `validateTikTokDirectSettings`; nil means it can post.
    func problem(creator: PosterTikTokCreator, duration: Double, audited: Bool) -> String? {
        if privacy.isEmpty || !creator.privacy_level_options.contains(privacy) { return "privacy_invalid" }
        if !audited && privacy != "SELF_ONLY" { return "audit_required" }
        if !consent { return "consent_required" }
        if (creator.comment_disabled && allowComment) || (creator.duet_disabled && allowDuet)
            || (creator.stitch_disabled && allowStitch) { return "interaction_disabled" }
        if discloseCommercial && !ownBrand && !brandedContent { return "commercial_disclosure_required" }
        if !discloseCommercial && (ownBrand || brandedContent) { return "commercial_disclosure_invalid" }
        if brandedContent && privacy == "SELF_ONLY" { return "branded_content_private" }
        if !duration.isFinite || duration <= 0 || duration > creator.max_video_post_duration_sec { return "duration_check_failed" }
        if accountId.isEmpty { return "account_required" }
        return nil
    }
}

/// One video's TikTok choices, as the publish sheet reads them.
struct PosterTikTokReview: Equatable {
    enum Mode: String { case direct, inbox }
    var mode: Mode = .direct
    var caption = ""
    var settings = PosterTikTokSettings()
    var ready = false
}
