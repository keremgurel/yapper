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
            body["privacyStatus"] = "public"
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
                body["settings"] = settingsBody(tiktok.settings)
                return try await poll("api/publish/tiktok/direct", body: .compact(body), key: key)
            }
            // The inbox endpoint takes no caption: it lands in drafts.
            return try await poll("api/publish/tiktok", body: .compact(target.sourceBody), key: key)
        }
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

    private static func settingsBody(_ settings: PosterTikTokSettings) -> [String: Any] {
        let data = (try? JSONEncoder().encode(settings)) ?? Data()
        return (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
    }

    private static func poll(_ path: String, body: [String: Any], key: String) async throws -> PosterPublishResult {
        for attempt in 0..<24 {
            do {
                return try await PosterHTTP.post(path, body: body, headers: ["Idempotency-Key": key])
            } catch let error as PosterHTTPError {
                let pending = error.code == "publish_state_pending" || error.code == "publish_in_progress"
                guard error.reconcilable, pending else { throw error }
                if attempt < 23 { try await Task.sleep(for: .seconds(5)) }
            }
        }
        throw PosterHTTPError(status: 202, code: "publish_in_progress", reason: nil, detail: nil, reconcilable: true,
                              message: PosterErrorCopy.publish("publish_in_progress"))
    }
}
