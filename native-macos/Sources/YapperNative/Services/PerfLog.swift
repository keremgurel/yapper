import Foundation
import os

/// Timings for the things that make a page feel slow: waiting for a session
/// token, each API round trip, and how long a tab takes to switch. Read with
/// `log stream --predicate 'subsystem == "app.yapper.native" && category == "perf"'`.
enum PerfLog {
    static let logger = Logger(subsystem: "app.yapper.native", category: "perf")

    static func milliseconds(since start: ContinuousClock.Instant) -> Int {
        let elapsed = ContinuousClock.now - start
        return Int(elapsed.components.seconds * 1000 + elapsed.components.attoseconds / 1_000_000_000_000_000)
    }
}
