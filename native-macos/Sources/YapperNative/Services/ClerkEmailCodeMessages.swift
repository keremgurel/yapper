import Foundation

/// What a failed email-code step says to the creator.
///
/// Clerk answers with error codes; these are the ones a person can do
/// something about, in their terms. Anything else falls back to Clerk's own
/// sentence, which is written for people, before a generic one.
enum ClerkEmailCodeMessages {
    static let unreachable = "Couldn't reach Yapper. Check your connection and try again."

    /// `reply` is the page's answer, nil when it never gave one.
    static func message(for reply: [String: Any]?) -> String {
        guard let reply else { return unreachable }
        return message(code: reply["error"] as? String, clerkMessage: reply["message"] as? String)
    }

    static func message(code: String?, clerkMessage: String?) -> String {
        switch code {
        case "not_ready":
            return unreachable
        case "form_param_format_invalid", "form_identifier_invalid", "form_param_nil", "form_email_address_invalid":
            return "That doesn't look like an email address."
        case "form_code_incorrect":
            return "That code isn't right. Check the email and try again."
        case "verification_expired":
            return "That code has expired. Send a new one."
        case "verification_failed", "too_many_attempts":
            return "Too many tries with that code. Send a new one."
        case "too_many_requests", "rate_limit_exceeded":
            return "Too many tries. Wait a minute, then try again."
        case "not_allowed_access", "identifier_not_allowed", "form_identifier_not_allowed":
            return "This email can't sign in to Yapper."
        case "no_email_code":
            return "This email can't get a sign-in code. Try another address."
        case "incomplete":
            return "Sign-in didn't finish. Send a new code and try again."
        default:
            if let clerkMessage, !clerkMessage.isEmpty { return clerkMessage }
            return "Something went wrong. Try again."
        }
    }
}
