import Foundation

/// Posting one prepared video to one platform, through the same routes and
/// idempotency keys the web sheet uses. TikTok and Facebook answer while the
/// platform is still processing, so those poll the same key until settled.
enum PosterPublishAPI {
    static func post(
        _ target: PosterPublishTarget,
        to platform: PublishPlatform,
        key: String,
        tiktok: PosterTikTokReview?,
        youtube: PosterYouTubeSettings,
        accountID: String?
    ) async throws -> PosterPublishResult {
        let copy = target.copy(for: platform)
        let headers = ["Idempotency-Key": key]
        switch platform {
        case .youtube:
            var body = target.sourceBody
            body["title"] = copy.title
            body["description"] = copy.body.isEmpty ? nil : copy.body
            body["thumbnailKey"] = target.thumbnailKey
            // The post answers once the video is up; `applyCover` sets the
            // cover afterwards instead of holding the post while YouTube
            // processes.
            body["deferCover"] = target.thumbnailKey == nil ? nil : true
            body.merge(youtube.body) { _, chosen in chosen }
            return try await PosterHTTP.post("api/publish/youtube", body: .compact(body), headers: headers)
        case .instagram:
            return try await PosterHTTP.post("api/publish/instagram", body: .compact(captionBody(target, copy)), headers: headers)
        case .facebook:
            var body = captionBody(target, copy)
            body["expectedAccountId"] = accountID ?? ""
            return try await poll("api/publish/facebook", body: .compact(body), key: key)
        case .tiktok:
            if let tiktok, tiktok.mode == .direct {
                var body = target.sourceBody
                body["caption"] = tiktok.caption
                body["settings"] = settingsBody(tiktok.settings, coverTimestampMs: target.coverTimestampMs)
                return try await poll("api/publish/tiktok/direct", body: .compact(body), key: key)
            }
            // The inbox endpoint takes no caption: it lands in drafts.
            return try await poll("api/publish/tiktok", body: .compact(target.sourceBody), key: key)
        }
    }

    /// Sets the cover on a YouTube video whose publish deferred it. The key
    /// is the one the upload used, which is how the server knows which video.
    /// A lost connection counts as not applied.
    static func applyCover(thumbnailKey: String, key: String) async -> Bool {
        let result: PosterCoverResult? = try? await PosterHTTP.post(
            "api/publish/youtube/cover", body: ["thumbnailKey": thumbnailKey], headers: ["Idempotency-Key": key])
        return result?.coverApplied == true
    }

    /// The route's code for a thrown publish error, in the shape the copy reads.
    static func code(for error: Error, platform: PublishPlatform) -> String {
        // A dropped connection may still have reached the platform.
        guard let error = error as? PosterHTTPError else { return "publish_in_progress" }
        if platform == .tiktok || platform == .facebook {
            if let reason = error.reason { return "\(platform.rawValue)_\(reason)" }
            if let code = error.code, code.hasPrefix("\(platform.rawValue)_") { return code }
            if platform == .facebook, let detail = error.detail { return "facebook_\(detail)" }
        }
        if error.code == "not_professional" { return "not_professional" }
        if error.status == 409, let code = error.code,
           code.hasSuffix("_not_connected") || code.hasSuffix("_reauth_required") {
            return "not_connected"
        }
        switch error.code {
        case "publish_in_progress", "publish_state_pending": return "publish_in_progress"
        case "publish_attempt_failed": return "publish_attempt_failed"
        default: return "post_failed"
        }
    }

    private static func captionBody(_ target: PosterPublishTarget, _ copy: (title: String, body: String)) -> [String: Any?] {
        var body = target.sourceBody
        let caption = copy.body.isEmpty ? copy.title : copy.body
        body["caption"] = caption.isEmpty ? nil : caption
        body["thumbnailKey"] = target.thumbnailKey
        return body
    }

    /// The Direct Post settings as the TikTok routes read them, now or scheduled.
    static func settingsBody(_ settings: PosterTikTokSettings, coverTimestampMs: Int? = nil) -> [String: Any] {
        let data = (try? JSONEncoder().encode(settings)) ?? Data()
        var body = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
        body["coverTimestampMs"] = coverTimestampMs
        return body
    }

    private static func poll(_ path: String, body: [String: Any], key: String) async throws -> PosterPublishResult {
        for attempt in 0..<PosterPublishPolling.attempts {
            do {
                return try await PosterHTTP.post(path, body: body, headers: ["Idempotency-Key": key])
            } catch let error as PosterHTTPError {
                let pending = error.code == "publish_state_pending" || error.code == "publish_in_progress"
                guard error.reconcilable, pending else { throw error }
                if attempt < PosterPublishPolling.attempts - 1 {
                    try await Task.sleep(for: PosterPublishPolling.wait(afterPending: attempt))
                }
            }
        }
        throw PosterHTTPError(status: 202, code: "publish_in_progress", reason: nil, detail: nil, reconcilable: true,
                              message: PosterErrorCopy.publish("publish_in_progress"))
    }
}
