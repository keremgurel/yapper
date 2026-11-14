import Foundation

/// What a Direct Post starts from once TikTok has said who is posting: the
/// widest audience the account allows and every interaction the account
/// allows, with the disclosures and the declaration left for the creator.
extension PosterTikTokSettings {
    /// Widest first. The default audience is the first one the account offers.
    static let audiencePreference = ["PUBLIC_TO_EVERYONE", "FOLLOWER_OF_CREATOR", "MUTUAL_FOLLOW_FRIENDS", "SELF_ONLY"]

    /// Audiences this account may choose; before TikTok's audit only "Only me".
    static func audiences(for context: PosterTikTokContext) -> [String] {
        context.creator.privacy_level_options.filter { context.audited || $0 == "SELF_ONLY" }
    }

    static func defaults(for context: PosterTikTokContext) -> PosterTikTokSettings {
        let offered = audiences(for: context)
        var settings = PosterTikTokSettings()
        settings.accountId = context.accountId
        settings.privacy = audiencePreference.first(where: offered.contains) ?? ""
        settings.allowComment = !context.creator.comment_disabled
        settings.allowDuet = !context.creator.duet_disabled
        settings.allowStitch = !context.creator.stitch_disabled
        return settings
    }

    /// The creator's own choices carried over a reload for the same account,
    /// changed only where the account no longer allows them. An audience that
    /// went away takes the declaration with it, because the post it covered
    /// is no longer the post being sent.
    func kept(for context: PosterTikTokContext) -> PosterTikTokSettings {
        let fresh = Self.defaults(for: context)
        guard accountId == context.accountId else { return fresh }
        var settings = self
        if !Self.audiences(for: context).contains(privacy) {
            settings.privacy = fresh.privacy
            settings.consent = false
        }
        if context.creator.comment_disabled { settings.allowComment = false }
        if context.creator.duet_disabled { settings.allowDuet = false }
        if context.creator.stitch_disabled { settings.allowStitch = false }
        return settings
    }
}
