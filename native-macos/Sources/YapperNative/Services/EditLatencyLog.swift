import Foundation
import os

/// Times the stages of an edit that the creator waits on, and writes them where
/// they can be read while the app is running:
///
///     log stream --predicate 'subsystem == "com.yapper.native"' --info
///
/// Latency in a running editor is not something a benchmark can answer. The
/// composition builder measured 95 ms on a real project while a framing change
/// took about a second to appear, so the second is somewhere between the two,
/// and guessing which of the debounce, the build, the main thread or the player
/// is holding it up is exactly how this kind of thing stays broken.
enum EditLatencyLog {
    private static let log = Logger(subsystem: "com.yapper.native", category: "latency")

    /// A stopwatch for one edit, from the moment it was asked for.
    struct Run {
        let name: String
        private let start = ContinuousClock.now
        private var last = ContinuousClock.now

        init(_ name: String) {
            self.name = name
        }

        /// Records reaching `stage`, with the time since the previous stage and
        /// since the edit was asked for.
        mutating func mark(_ stage: String) {
            let now = ContinuousClock.now
            // Built before the log call: an interpolated message is an escaping
            // autoclosure, which cannot reach into a value being mutated.
            let line = "\(name) \(stage)"
                + " +\(Self.milliseconds(from: last, to: now)) ms"
                + " (total \(Self.milliseconds(from: start, to: now)) ms)"
            EditLatencyLog.log.info("\(line, privacy: .public)")
            last = now
        }

        private static func milliseconds(from: ContinuousClock.Instant, to: ContinuousClock.Instant) -> String {
            let seconds = Double(from.duration(to: to).components.attoseconds) / 1e18
                + Double(from.duration(to: to).components.seconds)
            return String(format: "%.0f", seconds * 1000)
        }
    }
}
