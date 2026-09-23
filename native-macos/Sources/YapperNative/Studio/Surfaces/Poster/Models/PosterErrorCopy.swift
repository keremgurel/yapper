import Foundation

/// Creator-facing words for the codes the publish routes return. Same
/// meanings as `error-copy.ts`, `import-failure.ts`, `schedule-client.ts`.
enum PosterErrorCopy {
    static func publish(_ error: String) -> String {
        switch error {
        case "facebook_video_requirements":
            return "Facebook Reels need a vertical video, 3 to 90 seconds long, at least 540 by 960 pixels."
        case "facebook_page_required":
            return "Choose your Facebook Page in Connections first."
        case "tiktok_audit_required":
            return "Public Direct Post is waiting for TikTok approval. Use Only me for testing or choose the inbox method."
        case "tiktok_scope_not_authorized":
            return "Reconnect TikTok to grant Direct Post access, or choose the inbox method."
        case "facebook_reauth_required":
            return "Reconnect Facebook in Connections to renew publishing access."
        case "publish_in_progress":
            return "Delivery is not confirmed yet. Check the status again without sending another copy."
        case "not_connected", "tiktok_access_token_invalid", "tiktok_auth_removed":
            return "Reconnect your account in Connections, then check this attempt again."
        case "tiktok_spam_risk_too_many_pending_share":
            return "TikTok's pending upload limit is reached (up to 5 within 24 hours). Finish existing uploads in TikTok's inbox and wait for it to clear."
        case "publish_attempt_failed":
            return "This attempt failed. Start a new publish only after resolving the problem."
        case "not_professional":
            return "Your Instagram needs to be a Professional account (Business or Creator)."
        default:
            break
        }
        if error.hasPrefix("facebook_") { return "Facebook: \(error.dropFirst(9))" }
        if error.hasPrefix("tiktok_"), error.hasSuffix("_check_failed") {
            return "TikTok rejected the video (\(error.dropFirst(7))). Export it again with a supported format, duration, frame rate and size."
        }
        if error.hasPrefix("tiktok_spam_risk") {
            return "TikTok blocked this upload (\(error.dropFirst(7))). Check your account in TikTok before trying a new upload."
        }
        if error.hasPrefix("tiktok_") { return "TikTok could not deliver this video (\(error.dropFirst(7)))." }
        return "Couldn't post. Check your connection and try again."
    }

    static func importFailure(_ code: String?) -> String {
        switch code {
        case "rate_limited": "You have imported as many originals as this hour allows. Try again shortly."
        case "not_entitled": "Importing an original needs an active subscription."
        case "storage_full": "Your storage is full. Delete something from the library and try again."
        case "too_many_pending_uploads": "There are too many uploads in flight. Give the last one a moment to finish."
        case "clip_too_large": "That post is larger than the app can import."
        case "not_connected": "Reconnect Instagram in Connections, then try again."
        case "not_a_video": "That post is not a video, so there is nothing to cross-post."
        case "no_source_file": "Instagram did not hand over a file for that post. It usually means the post is too old to fetch."
        case "import_timeout", "download_timeout": "Instagram took too long to hand the file over. Try again."
        case "download_failed": "The download from Instagram failed part way through. Try again."
        case "storage_unavailable": "Storage is not reachable right now. Try again in a minute."
        default: "That original could not be prepared. Your selection is still here."
        }
    }

    static func schedule(_ code: String?) -> String {
        switch code {
        case "scheduling_unavailable": "Scheduled publishing isn't available on this server yet."
        case "invalid_body": "Choose a time at least a minute ahead and within the next 90 days. Check that every destination has valid copy."
        case "destination_not_connected": "Connect every selected destination before scheduling."
        case "destination_account_changed": "The connected account has changed. Schedule again for the new account."
        case "thumbnail_unavailable": "The cover is no longer available. Prepare a new cover and schedule again."
        case "media_unavailable", "media_not_found": "The saved video couldn't be found. Check its source in your library."
        case "content_item_unavailable": "The library item is no longer available."
        case "schedule_request_changed": "An earlier version of this schedule was already saved. Check Calendar before creating another."
        case "duplicate_destination": "The same video was selected more than once for a destination. Keep one copy and try again."
        case "unauthorized": "Sign in again to manage your scheduled posts."
        default: "We couldn't confirm the schedule. Check Calendar before trying again."
        }
    }

    static func upload(_ code: String) -> String {
        switch code {
        case "not_video": "Choose a video file."
        case "storage_full": "Storage is full."
        case "locked": "Uploading needs an active plan."
        case "too_large": "That video is over the 4 GB upload limit."
        case "network": "The upload lost its connection. Your file is safe. Try again."
        default: "The upload could not finish. Try again; no blank video was created."
        }
    }
}
