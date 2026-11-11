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
    @Published private var shared: [String: String] = [:]
    @Published private var overrides: [String: [PublishPlatform: String]] = [:]
    @Published private var generationUndo: [String: (caption: String?, title: String)] = [:]
    @Published private var captions: [String: PosterCaptionSet] = [:]
    @Published private var descriptions: [String: String] = [:]
    @Published private var briefs: [String: String] = [:]
    @Published private var outcomes: [String: [PublishPlatform: PosterOutcome]] = [:]

    func cover(_ video: PosterVideo) -> PosterCoverDraft { covers[video.id] ?? PosterCoverDraft() }
    func setCover(_ draft: PosterCoverDraft, for video: PosterVideo) { covers[video.id] = draft }
    func hasCover(_ video: PosterVideo) -> Bool { covers[video.id] != nil }

    /// Destination selection is always explicit.
    func destinations(_ video: PosterVideo, connected: [PublishPlatform]) -> Set<PublishPlatform> {
        destinations[video.id] ?? []
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
        for platform in PublishPlatform.enabledCases {
            if let value = overrides[video.id]?[platform] ?? shared[video.id] {
                var caption = set.caption(for: platform)
                caption.body = value
                caption.hashtags = []
                set[platform] = caption
            }
        }
        return set
    }

    func sharedCaption(_ video: PosterVideo) -> String { shared[video.id] ?? video.sourceCaption ?? "" }

    func setSharedCaption(_ value: String, for video: PosterVideo) {
        shared[video.id] = value
        generationUndo[video.id] = nil
    }

    func override(_ platform: PublishPlatform, for video: PosterVideo) -> String {
        overrides[video.id]?[platform] ?? ""
    }

    func setOverride(_ value: String, for platform: PublishPlatform, video: PosterVideo) {
        overrides[video.id, default: [:]][platform] = value.isEmpty ? nil : value
    }

    func title(_ video: PosterVideo) -> String { captions[video.id]?.caption(for: .youtube).title ?? "" }

    func setTitle(_ value: String, for video: PosterVideo) {
        var caption = captions[video.id]?.caption(for: .youtube) ?? .blank(.youtube)
        caption.title = String(value.prefix(100))
        setCaption(caption, for: video)
        generationUndo[video.id] = nil
    }

    func applySharedGeneration(_ caption: PosterCaption, to video: PosterVideo, initialCaption: String, initialTitle: String) {
        let previous = (shared[video.id], title(video))
        let changesBody = sharedCaption(video) == initialCaption && !caption.rendered.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        let changesTitle = caption.platform == PublishPlatform.youtube.rawValue && title(video) == initialTitle && initialTitle.isEmpty && !caption.title.isEmpty
        guard changesBody || changesTitle else { return }
        if changesBody { shared[video.id] = caption.rendered }
        if changesTitle { setTitle(caption.title, for: video) }
        generationUndo[video.id] = previous
    }

    func canUndoGeneration(_ video: PosterVideo) -> Bool { generationUndo[video.id] != nil }

    func undoGeneration(_ video: PosterVideo) {
        guard let previous = generationUndo[video.id] else { return }
        shared[video.id] = previous.caption
        setTitle(previous.title, for: video)
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

    func description(_ video: PosterVideo) -> String { descriptions[video.id] ?? "" }
    func setDescription(_ value: String, for video: PosterVideo) { descriptions[video.id] = value }

    func copyCaption(from source: PublishPlatform, to destinations: Set<PublishPlatform>, for video: PosterVideo) {
        let current = captions(video)
        let reference = current.caption(for: source)
        guard !reference.rendered.isEmpty else { return }
        for platform in destinations where platform != source {
            var target = current.caption(for: platform)
            target.body = reference.body
            target.hashtags = reference.hashtags
            setCaption(target, for: video)
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

    private var revisions: [String: String] = [:]
    func useRevision(_ revision: String, for video: PosterVideo) {
        if let previous = revisions[video.id], previous != revision {
            covers[video.id] = nil
            captions[video.id] = nil
            shared[video.id] = nil
            overrides[video.id] = nil
            generationUndo[video.id] = nil
            outcomes[video.id] = nil
        }
        revisions[video.id] = revision
    }

    private func sourceCaptions(_ video: PosterVideo) -> PosterCaptionSet {
        guard let original = video.sourceCaption else { return [:] }
        var set: PosterCaptionSet = [:]
        for platform in PublishPlatform.enabledCases {
            set[platform] = PosterCaption(platform: platform.rawValue, title: "", body: original, hashtags: [])
        }
        return set
    }
}
