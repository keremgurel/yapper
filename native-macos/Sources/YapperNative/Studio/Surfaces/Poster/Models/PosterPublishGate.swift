import Foundation

/// Whether the one publish button can send. The selection is authoritative:
/// every chosen destination still to send has to be ready, so a press never
/// quietly posts to fewer places than the creator picked. Mirrors the web's
/// inline publish (`destination-readiness.ts` and the embedded cross-post
/// sheet).
struct PosterPublishGate: Equatable {
    let canSend: Bool
    let youtubeDescriptionTooLong: Bool
    /// The destinations holding the press back, in platform order, so the
    /// disabled button can say what to finish.
    let waiting: [PublishPlatform]

    /// `remaining` is the chosen destinations not yet posted or scheduled,
    /// and `readiness` theirs. A failed or unconfirmed one counts as ready:
    /// sending again checks the same attempt instead of posting twice.
    init(remaining: [PublishPlatform], readiness: [PosterReadiness], publishable: [PublishPlatform], videoReady: Bool,
         youtube: PosterYouTubeSettings, youtubeDescription: String, tiktokReady: Bool) {
        let youtubeChosen = remaining.contains(.youtube)
        youtubeDescriptionTooLong = youtubeChosen && PosterYouTubeSettings.descriptionTooLong(youtubeDescription)
        let sendable: Set<PosterReadiness.State> = [.ready, .failed, .scheduled]
        let blocked = Set(readiness.filter { !sendable.contains($0.state) }.map(\.platform))
            .union(remaining.filter { !publishable.contains($0) })
            .union(youtubeChosen && (youtube.madeForKids == nil || youtubeDescriptionTooLong) ? [.youtube] : [])
            .union(remaining.contains(.tiktok) && !tiktokReady ? [.tiktok] : [])
        waiting = remaining.filter(blocked.contains)
        canSend = !remaining.isEmpty && videoReady && readiness.count == remaining.count && waiting.isEmpty
    }
}
