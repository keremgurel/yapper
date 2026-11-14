import AVFoundation
import Foundation

/// TikTok's choices for the open video: who is posting, the audience and
/// interaction choices, and the posting declaration. The caption is the one
/// on the TikTok card, and the video itself is already on the page, so this
/// only needs the video's length to check it against the account's limit.
@MainActor
final class PosterTikTokReviewModel: ObservableObject {
    /// Where the TikTok choices stand with the declaration set aside. The
    /// line under the destinations reads this.
    enum Standing: Equatable { case checking, set, needsReview }

    @Published var mode: PosterTikTokReview.Mode = .direct
    @Published var settings = PosterTikTokSettings()
    @Published private(set) var context: PosterTikTokContext?
    @Published private(set) var duration: Double?
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

    var standing: Standing {
        if durationError != nil { return .needsReview }
        if mode == .inbox { return duration == nil ? .checking : .set }
        if contextError != nil { return .needsReview }
        guard let context, let duration else { return .checking }
        let problem = settings.problemBesidesConsent(creator: context.creator, duration: duration, audited: context.audited)
        return problem == nil ? .set : .needsReview
    }

    /// True when checking the declaration is all a Direct Post still needs.
    var awaitsConsentOnly: Bool {
        mode == .direct && standing == .set && !settings.consent
    }

    var tooLong: Bool {
        guard let context, let duration else { return false }
        return duration > context.creator.max_video_post_duration_sec
    }

    var privacyOptions: [String] {
        context.map(PosterTikTokSettings.audiences(for:)) ?? []
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

    /// Reads who is posting and the video's length together. Called when
    /// TikTok is chosen and again whenever the video's source changes.
    func load(for video: PosterVideo) async {
        async let creator: Void = loadCreatorIfNeeded()
        await loadDuration(for: video)
        await creator
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

    /// A new account starts from its defaults. The same account keeps what
    /// the creator already chose.
    func applyCreator(_ context: PosterTikTokContext) {
        self.context = context
        contextError = nil
        settings = settings.kept(for: context)
    }

    /// Reads the length from the local file when there is one, otherwise from
    /// the uploaded master.
    func loadDuration(for video: PosterVideo) async {
        durationError = nil
        do {
            if let url = video.previewURL, url.isFileURL {
                applyDuration(try await AVURLAsset(url: url).load(.duration).seconds)
            } else if video.submissionID != nil || video.mediaKey != nil {
                let preview: PosterVideoPreview = try await PosterHTTP.post("api/publish/preview",
                    body: .compact(["submissionId": video.submissionID, "mediaKey": video.mediaKey]))
                applyDuration(preview.duration)
            }
        } catch {
            durationError = "Couldn't check this video's length for TikTok. Reopen the video to try again."
        }
    }

    func applyDuration(_ seconds: Double) {
        duration = seconds
    }

    /// Changes when an upload or import finishes, so the length is read from
    /// whatever the video has become.
    static func durationSource(for video: PosterVideo) -> String {
        [video.previewURL?.absoluteString, video.submissionID, video.mediaKey].map { $0 ?? "" }.joined(separator: "|")
    }

    private func loadCreatorIfNeeded() async {
        if context == nil { await loadCreator() }
    }
}
