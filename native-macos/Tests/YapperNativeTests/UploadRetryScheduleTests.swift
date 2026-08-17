import Foundation
import Testing
@testable import YapperNative

/// When a failed audio upload is worth sending again.
///
/// The old schedule retried everything three times a second apart, which turned
/// a momentary rate limit into a failed edit and made a signed-out account wait
/// through three refusals before hearing about it.
@Suite
struct UploadRetryScheduleTests {
    @Test("A rate limit waits seconds, not milliseconds")
    func rateLimitBacksOff() {
        #expect(UploadRetrySchedule.wait(status: 429, retryAfter: nil, attempt: 0) == 2)
        #expect(UploadRetrySchedule.wait(status: 429, retryAfter: nil, attempt: 1) == 5)
        #expect(UploadRetrySchedule.wait(status: 429, retryAfter: nil, attempt: 2) == 12)
    }

    @Test("The server's own number wins, within reason")
    func honoursRetryAfter() {
        #expect(UploadRetrySchedule.wait(status: 429, retryAfter: "8", attempt: 0) == 8)
        // A ten-minute wait is not a wait a creator sits through.
        #expect(UploadRetrySchedule.wait(status: 503, retryAfter: "600", attempt: 0) == 60)
    }

    @Test("An HTTP date reads as the seconds until it")
    func retryAfterDate() {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(identifier: "GMT")
        formatter.dateFormat = "EEE, dd MMM yyyy HH:mm:ss zzz"
        let header = formatter.string(from: Date().addingTimeInterval(20))
        let seconds = UploadRetrySchedule.seconds(fromRetryAfter: header)
        #expect(seconds != nil)
        #expect(abs((seconds ?? 0) - 20) <= 2)
    }

    @Test("Account and configuration problems are not retried at all")
    func settledFailuresStop() {
        for status in [400, 401, 402, 403, 404, 413, 501] {
            #expect(UploadRetrySchedule.wait(status: status, retryAfter: nil, attempt: 0) == nil)
        }
    }

    @Test("A flaky connection still retries quickly")
    func transientFailuresRetryFast() {
        #expect(UploadRetrySchedule.wait(status: 0, retryAfter: nil, attempt: 0) == 0.35)
        #expect(UploadRetrySchedule.wait(status: 502, retryAfter: nil, attempt: 1) == 0.9)
    }

    @Test("The last attempt has nothing after it")
    func stopsAtTheLastAttempt() {
        let last = UploadRetrySchedule.attempts - 1
        #expect(UploadRetrySchedule.wait(status: 429, retryAfter: nil, attempt: last) == nil)
    }

    @Test("A decode failure on a good response is not sent again")
    func successfulStatusDoesNotRetry() {
        #expect(UploadRetrySchedule.wait(status: 200, retryAfter: nil, attempt: 0) == nil)
    }
}
