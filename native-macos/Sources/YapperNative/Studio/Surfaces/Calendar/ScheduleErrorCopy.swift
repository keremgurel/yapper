import Foundation

/// The web's `scheduleErrorMessage`: a route's error code in the creator's
/// terms. Automations falls back to this for codes it doesn't own.
enum ScheduleErrorCopy {
    static let fallback = "We couldn't confirm the change. Refresh Calendar to check the saved result before trying again."

    static let messages: [String: String] = [
        "scheduling_unavailable": "Scheduled publishing isn't available on this server yet.",
        "invalid_body": "Choose a time at least a minute ahead and within the next 90 days. Check that every destination has valid copy.",
        "destination_not_connected": "Connect every selected destination before scheduling.",
        "destination_account_changed": "The connected account has changed. Cancel this schedule and create one for the new account.",
        "schedule_already_started": "Sending has already started. Refresh to see the result.",
        "schedule_not_retryable": "This post can't be retried from its current state. Refresh to see the result.",
        "publish_state_pending": "The platform may have accepted this post. Check the destination before taking further action.",
        "publish_in_progress": "The platform is still processing this attempt. Check the destination before taking further action.",
        "thumbnail_unavailable": "The cover is no longer available. Prepare a new cover and schedule again.",
        "media_unavailable": "The saved video is no longer available. Open it in your Library to check the source.",
        "media_not_found": "The saved video couldn't be found. Check its source in your Library.",
        "content_item_unavailable": "The Library item is no longer available.",
        "schedule_request_changed": "An earlier version of this schedule was already saved. Check Calendar before creating another.",
        "duplicate_destination": "The same video was selected more than once for a destination. Keep one copy and try again.",
        "publish_failed": "Sending failed. Choose a new time to retry, or cancel this post.",
        "publish_attempt_failed": "The previous sending attempt failed. Choose a new time to retry.",
        "upload_failed": "The video could not be sent. Choose a new time to retry.",
        "unauthorized": "Sign in again to manage your scheduled posts.",
    ]

    static func message(forCode code: String?) -> String {
        code.flatMap { messages[$0] } ?? fallback
    }

    /// A failed call: a known code wins; a lost session keeps the client's
    /// own sign-in message.
    static func message(for error: Error) -> String {
        guard let api = error as? StudioAPIError else { return fallback }
        if let code = api.code, let known = messages[code] { return known }
        return api.isSignedOut ? api.message : fallback
    }
}
