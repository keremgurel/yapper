import Foundation

/// A tab a Studio Chirpy reply opens with state filled in, as the web bridge
/// reports it in the reply's `open`. Only Poster today: Chirpy sets a video
/// up and the creator's own Publish or Schedule button posts it.
struct StudioChirpyOpen: Equatable, Sendable {
    let poster: PosterPrefill

    /// Reads the bridge's `open` object; anything it does not recognise is
    /// ignored, so an older build simply shows the reply's text.
    init?(payload: Any?) {
        guard let payload = payload as? [String: Any],
              payload["tab"] as? String == "poster",
              let params = payload["params"] as? [String: Any],
              let prefill = PosterPrefill(params: params)
        else { return nil }
        poster = prefill
    }

    @MainActor
    func apply() {
        PosterHandoff.shared.prefill(poster)
        StudioWebCommands.shared.openPoster(itemID: poster.videoID)
    }
}

/// What Chirpy filled in for one video in Poster.
struct PosterPrefill: Equatable, Sendable {
    let videoID: String
    let platforms: Set<PublishPlatform>?
    let captions: [PosterCaption]
    let thumbnailPrompt: String?
    let scheduleAt: Date?

    init?(params: [String: Any]) {
        guard let videoID = params["videoID"] as? String, !videoID.isEmpty else { return nil }
        self.videoID = videoID
        let platforms = (params["platforms"] as? [String] ?? []).compactMap(PublishPlatform.init(rawValue:))
        self.platforms = platforms.isEmpty ? nil : Set(platforms)
        captions = (params["captions"] as? [[String: Any]] ?? []).compactMap { caption in
            guard let platform = caption["platform"] as? String,
                  PublishPlatform(rawValue: platform) != nil else { return nil }
            return PosterCaption(
                platform: platform,
                title: caption["title"] as? String ?? "",
                body: caption["body"] as? String ?? "",
                hashtags: caption["hashtags"] as? [String] ?? []
            )
        }
        thumbnailPrompt = (params["thumbnailPrompt"] as? String).flatMap { $0.isEmpty ? nil : $0 }
        scheduleAt = (params["scheduleAt"] as? String).flatMap(Self.instant)
    }

    private static func instant(_ value: String) -> Date? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: value) { return date }
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.date(from: value)
    }
}
