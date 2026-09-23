import Foundation

/// Everything the creator prepared, per video: its cover, where it goes, its
/// captions, its caption prompt, and what happened once it was sent. Held
/// per video because two videos genuinely go to different places, and so
/// switching videos never loses an edit.
@MainActor
final class PosterDraftStore: ObservableObject {
    static let shared = PosterDraftStore()

    @Published private var covers: [String: PosterCoverDraft] = [:]
    @Published private var destinations: [String: Set<PublishPlatform>] = [:]
    @Published private var captions: [String: PosterCaptionSet] = [:]
    @Published private var briefs: [String: String] = [:]
    @Published private var outcomes: [String: [PublishPlatform: PosterOutcome]] = [:]

    func cover(_ video: PosterVideo) -> PosterCoverDraft { covers[video.id] ?? PosterCoverDraft() }
    func setCover(_ draft: PosterCoverDraft, for video: PosterVideo) { covers[video.id] = draft }
    func hasCover(_ video: PosterVideo) -> Bool { covers[video.id] != nil }

    /// Every connected channel except the one the video is already on,
    /// until the creator picks for themselves.
    func destinations(_ video: PosterVideo, connected: [PublishPlatform]) -> Set<PublishPlatform> {
        destinations[video.id] ?? Set(connected.filter { $0 != video.platform })
    }

    func toggle(_ platform: PublishPlatform, for video: PosterVideo, connected: [PublishPlatform]) {
        var next = destinations(video, connected: connected)
        if next.contains(platform) { next.remove(platform) } else { next.insert(platform) }
        destinations[video.id] = next
    }

    /// A channel post starts from its own caption on every platform.
    func captions(_ video: PosterVideo) -> PosterCaptionSet {
        var set = sourceCaptions(video)
        for (platform, caption) in captions[video.id] ?? [:] { set[platform] = caption }
        return set
    }

    func setCaption(_ caption: PosterCaption, for video: PosterVideo) {
        guard let platform = PublishPlatform(rawValue: caption.platform) else { return }
        var set = captions[video.id] ?? [:]
        set[platform] = caption
        captions[video.id] = set
    }

    func applyGenerated(_ generated: [PosterCaption], to videoID: String, titleOnly: Bool, sourceCaption: String) {
        captions[videoID] = (captions[videoID] ?? [:]).merging(generated: generated, titleOnly: titleOnly, sourceCaption: sourceCaption)
    }

    /// Puts the original caption back on every platform, keeping titles.
    func useOriginalCaption(for video: PosterVideo) {
        let current = captions(video)
        for (platform, original) in sourceCaptions(video) {
            var caption = original
            caption.title = current[platform]?.title ?? ""
            setCaption(caption, for: video)
        }
    }

    func brief(_ video: PosterVideo) -> String { briefs[video.id] ?? PosterCaptionBrief.standard }
    func setBrief(_ value: String, for video: PosterVideo) { briefs[video.id] = value }

    func outcome(_ video: PosterVideo, _ platform: PublishPlatform) -> PosterOutcome? { outcomes[video.id]?[platform] }

    func record(_ outcome: PosterOutcome) {
        var set = outcomes[outcome.videoID] ?? [:]
        set[outcome.platform] = outcome
        outcomes[outcome.videoID] = set
    }

    private func sourceCaptions(_ video: PosterVideo) -> PosterCaptionSet {
        guard let original = video.sourceCaption else { return [:] }
        var set: PosterCaptionSet = [:]
        for platform in PublishPlatform.allCases {
            set[platform] = PosterCaption(platform: platform.rawValue, title: "", body: original, hashtags: [])
        }
        return set
    }
}
