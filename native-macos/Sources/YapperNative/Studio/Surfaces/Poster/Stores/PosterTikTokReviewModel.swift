import Foundation

/// TikTok's required review for one video: who is posting, a playable
/// preview, the audience and interaction choices, and consent. Its `review`
/// is what the sheet posts and whether it can.
@MainActor
final class PosterTikTokReviewModel: ObservableObject {
    @Published var mode: PosterTikTokReview.Mode = .direct
    @Published var caption: String
    @Published var settings = PosterTikTokSettings()
    @Published private(set) var context: PosterTikTokContext?
    @Published private(set) var preview: PosterVideoPreview?
    @Published private(set) var contextError: String?
    @Published private(set) var previewError: String?

    let target: PosterPublishTarget

    init(target: PosterPublishTarget) {
        self.target = target
        let copy = target.copy(for: .tiktok)
        caption = copy.body.isEmpty ? copy.title : copy.body
    }

    var problem: String? {
        guard let context, let preview else { return "not_ready" }
        return settings.problem(creator: context.creator, duration: preview.duration, audited: context.audited)
    }

    var review: PosterTikTokReview {
        PosterTikTokReview(
            mode: mode, caption: caption, settings: settings,
            ready: preview != nil && (mode == .inbox || (problem == nil && caption.count <= 2200))
        )
    }

    var tooLong: Bool {
        guard let context, let preview else { return false }
        return preview.duration > context.creator.max_video_post_duration_sec
    }

    /// Audiences this account may choose; before TikTok's audit only "Only me".
    var privacyOptions: [String] {
        guard let context else { return [] }
        return context.creator.privacy_level_options.filter { context.audited || $0 == "SELF_ONLY" }
    }

    func load() async {
        async let creator: Void = loadCreator()
        async let video: Void = loadPreview()
        _ = await (creator, video)
    }

    func setCommercial(_ on: Bool) {
        settings.discloseCommercial = on
        settings.ownBrand = false
        settings.brandedContent = false
    }

    func reconnect() {
        StudioWebCommands.shared.openOAuth(path: "/api/publish/connect/tiktok")
    }

    private func loadCreator() async {
        do {
            let context: PosterTikTokContext = try await PosterHTTP.get("api/publish/tiktok/creator")
            self.context = context
            settings.accountId = context.accountId
        } catch let failure as PosterHTTPError {
            contextError = PosterErrorCopy.publish(failure.code ?? "tiktok_creator_unavailable")
        } catch {
            contextError = PosterErrorCopy.publish("tiktok_creator_unavailable")
        }
    }

    private func loadPreview() async {
        do {
            preview = try await PosterHTTP.post("api/publish/preview", body: .compact(target.sourceBody.filter { $0.key != "contentItemId" }))
        } catch {
            previewError = "Couldn't load this video. Close and reopen publishing to try again."
        }
    }
}
