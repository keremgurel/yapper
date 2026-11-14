import Foundation

/// Whether the one publish button can send. The selection is authoritative:
/// every chosen destination still to send has to be ready, so a press never
/// quietly posts to fewer places than the creator picked. Mirrors the web's
/// inline publish (`destination-readiness.ts` and the embedded cross-post
/// sheet).
struct PosterPublishGate: Equatable {
    let canSend: Bool
    let youtubeDescriptionTooLong: Bool
    /// The destinations holding the press back, in platform order.
    let waiting: [PublishPlatform]
    /// The destinations with something to finish above, so the disabled
    /// button can name them. TikTok is left out when the posting declaration
    /// is all it needs, because that box sits right beside the button.
    let finishing: [PublishPlatform]
    /// True when checking the posting declaration is all the press needs.
    let needsConsentOnly: Bool

    /// `remaining` is the chosen destinations not yet posted or scheduled,
    /// and `readiness` theirs. A failed or unconfirmed one counts as ready:
    /// sending again checks the same attempt instead of posting twice.
    /// `tiktokAwaitingConsent` says TikTok's own settings are fine and only
    /// the declaration is unchecked.
    init(remaining: [PublishPlatform], readiness: [PosterReadiness], publishable: [PublishPlatform], videoReady: Bool,
         youtube: PosterYouTubeSettings, youtubeDescription: String, tiktokReady: Bool, tiktokAwaitingConsent: Bool = false) {
        let youtubeChosen = remaining.contains(.youtube)
        youtubeDescriptionTooLong = youtubeChosen && PosterYouTubeSettings.descriptionTooLong(youtubeDescription)
        let sendable: Set<PosterReadiness.State> = [.ready, .failed, .scheduled]
        let unfinished = Set(readiness.filter { !sendable.contains($0.state) }.map(\.platform))
            .union(remaining.filter { !publishable.contains($0) })
            .union(youtubeChosen && (youtube.madeForKids == nil || youtubeDescriptionTooLong) ? [.youtube] : [])
        let tiktokWaiting = remaining.contains(.tiktok) && !tiktokReady
        let blocked = unfinished.union(tiktokWaiting ? [.tiktok] : [])
        let consentIsAllTikTokNeeds = tiktokWaiting && tiktokAwaitingConsent && !unfinished.contains(.tiktok)
        waiting = remaining.filter(blocked.contains)
        finishing = waiting.filter { !(consentIsAllTikTokNeeds && $0 == .tiktok) }
        needsConsentOnly = consentIsAllTikTokNeeds && finishing.isEmpty
        canSend = !remaining.isEmpty && videoReady && readiness.count == remaining.count && waiting.isEmpty
    }
}
