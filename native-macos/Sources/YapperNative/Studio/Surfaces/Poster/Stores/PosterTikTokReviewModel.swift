import AVFoundation
import Foundation

/// TikTok's required choices for the open video: who is posting, the
/// audience and interaction choices, and consent. The caption is the one on
/// the TikTok card, and the video itself is already on the page, so this
/// only needs the video's length to check it against the account's limit.
@MainActor
final class PosterTikTokReviewModel: ObservableObject {
    @Published var mode: PosterTikTokReview.Mode = .direct
    @Published var settings = PosterTikTokSettings()
    @Published private(set) var context: PosterTikTokContext?
    @Published private(set) var duration: Double?
    @Published private(set) var previewURL: URL?
    @Published private(set) var contextError: String?
    @Published private(set) var durationError: String?

    var problem: String? {
        guard let context, let duration else { return "not_ready" }
        return settings.problem(creator: context.creator, duration: duration, audited: context.audited)
    }

    func review(caption: String) -> PosterTikTokReview {
        PosterTikTokReview(
            mode: mode, caption: caption, settings: settings,
            ready: duration != nil && (mode == .inbox || (problem == nil && caption.count <= 2200))
        )
    }

    var tooLong: Bool {
        guard let context, let duration else { return false }
        return duration > context.creator.max_video_post_duration_sec
    }

    /// Audiences this account may choose; before TikTok's audit only "Only me".
    var privacyOptions: [String] {
        guard let context else { return [] }
        return context.creator.privacy_level_options.filter { context.audited || $0 == "SELF_ONLY" }
    }

    var audienceLabel: String {
        PosterTikTokSettings.privacyLabels[settings.privacy] ?? "Choose audience"
    }

    func setCommercial(_ on: Bool) {
        settings.discloseCommercial = on
        settings.ownBrand = false
        settings.brandedContent = false
    }

    func reconnect() {
        StudioWebCommands.shared.openOAuth(path: "/api/publish/connect/tiktok")
    }

    func loadCreator() async {
        do {
            let context: PosterTikTokContext = try await PosterHTTP.get("api/publish/tiktok/creator")
            applyCreator(context)
        } catch let failure as PosterHTTPError {
            contextError = PosterErrorCopy.publish(failure.code ?? "tiktok_creator_unavailable")
        } catch {
            contextError = PosterErrorCopy.publish("tiktok_creator_unavailable")
        }
    }

    func applyCreator(_ context: PosterTikTokContext) {
        self.context = context
        contextError = nil
        if settings.accountId != context.accountId || !privacyOptions.contains(settings.privacy) {
            settings.privacy = ""
            settings.consent = false
        }
        settings.accountId = context.accountId
    }

    /// Reads the length from the local file when there is one, otherwise from
    /// the uploaded master. Called again whenever the video's source changes.
    func loadDuration(for video: PosterVideo) async {
        durationError = nil
        do {
            if let url = video.previewURL, url.isFileURL {
                duration = try await AVURLAsset(url: url).load(.duration).seconds
                previewURL = url
            } else if video.submissionID != nil || video.mediaKey != nil {
                let preview: PosterVideoPreview = try await PosterHTTP.post("api/publish/preview",
                    body: .compact(["submissionId": video.submissionID, "mediaKey": video.mediaKey]))
                duration = preview.duration
                previewURL = URL(string: preview.url)
            }
        } catch {
            durationError = "Couldn't check this video's length for TikTok. Reopen the video to try again."
        }
    }

}
