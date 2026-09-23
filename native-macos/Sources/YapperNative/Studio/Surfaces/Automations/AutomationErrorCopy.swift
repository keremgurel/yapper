import Foundation

/// The web's `automationErrorMessage`: automation codes first, then the
/// scheduling codes a delivery can carry.
enum AutomationErrorCopy {
    static let messages: [String: String] = [
        "automation_changed": "These settings changed in another window. Reload the saved settings before editing again.",
        "automation_unavailable": "Automatic sending isn't available on this server yet. You can keep your setup saved while paused.",
        "automation_paused": "Enable the rule before retrying an import.",
        "automation_not_retryable": "This import is no longer waiting for a retry. Refresh its status.",
        "source_account_changed": "The Instagram account changed. Pause and save the rule again for the account you want to use.",
        "instagram_account_changed": "The Instagram account changed. Pause and save the rule again for the account you want to use.",
        "instagram_not_connected": "Reconnect Instagram to continue checking for new videos.",
        "instagram_reauth_required": "Reconnect Instagram to continue checking for new videos.",
        "instagram_check_failed": "Instagram couldn't be checked. Your previous results are kept; the next check will try again.",
        "instagram_cursor_expired": "Instagram's list changed. The next check will restart the scan without duplicating earlier imports.",
        "not_entitled": "An active plan is required to import and repurpose Instagram videos.",
        "storage_full": "Your storage is full. Free space in Storage, then retry this import.",
        "no_source_file": "Instagram didn't provide a usable source file. Add the original video in Poster to repurpose it.",
        "not_a_video": "This Instagram post does not contain a single video that can be repurposed.",
        "clip_too_large": "This video is too large for an automatic import. Add your original file in Poster.",
        "invalid_body": "Check the selected destinations and connect each account before enabling the rule.",
        "import_failed": "The video couldn't be imported. Retry the import or add its original file in Poster.",
        "download_failed": "Instagram's video couldn't be downloaded. Try the import again.",
        "import_timeout": "The import took too long. Try the import again.",
        "download_timeout": "The video download took too long. Try the import again.",
        "rate_limited": "The import limit was reached. Wait a little, then retry.",
    ]

    static func message(forCode code: String?) -> String {
        code.flatMap { messages[$0] } ?? ScheduleErrorCopy.message(forCode: code)
    }

    static func message(for error: Error) -> String {
        if let api = error as? StudioAPIError, let code = api.code, let known = messages[code] {
            return known
        }
        return ScheduleErrorCopy.message(for: error)
    }
}
