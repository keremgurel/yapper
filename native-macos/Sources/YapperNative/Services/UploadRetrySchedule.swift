import Foundation

/// How long to wait before sending a failed upload again, and whether to bother.
///
/// A 429 is the far end asking for room, so the answer is seconds rather than
/// the milliseconds a flaky connection needs, and whatever `Retry-After` names
/// when the server names a number. Retrying a refusal three times in a second
/// is what turns a brief rate limit into a failed edit.
///
/// An account problem is not going to fix itself between attempts, so it is not
/// retried at all: the creator hears what to fix instead of waiting through
/// three identical refusals.
enum UploadRetrySchedule {
    static let attempts = 5

    /// Seconds to wait before the attempt after `attempt`, or nil to stop.
    static func wait(status: Int, retryAfter: String?, attempt: Int) -> Double? {
        guard attempt + 1 < attempts else { return nil }
        // A 2xx that reached the failure path failed to decode, which the same
        // request will do again.
        if (200 ..< 300).contains(status) { return nil }
        if settled(status) { return nil }
        if status == 429 || status == 503 {
            if let named = seconds(fromRetryAfter: retryAfter) { return min(max(named, 1), 60) }
            return [2, 5, 12, 30][min(attempt, 3)]
        }
        return [0.35, 0.9, 2, 4][min(attempt, 3)]
    }

    /// Statuses that say the creator, or the server's configuration, has
    /// something to fix. Waiting changes none of them.
    private static func settled(_ status: Int) -> Bool {
        [400, 401, 402, 403, 404, 413, 501].contains(status)
    }

    /// `Retry-After` carries either a count of seconds or an HTTP date.
    static func seconds(fromRetryAfter header: String?) -> Double? {
        guard let header = header?.trimmingCharacters(in: .whitespaces), !header.isEmpty else {
            return nil
        }
        if let seconds = Double(header) { return max(0, seconds) }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(identifier: "GMT")
        formatter.dateFormat = "EEE, dd MMM yyyy HH:mm:ss zzz"
        guard let date = formatter.date(from: header) else { return nil }
        return max(0, date.timeIntervalSinceNow)
    }
}
