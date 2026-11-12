import Foundation

/// A moment in a file, to the tenth of a second: fine enough to trim by, and
/// short enough to read at a glance.
enum MediaTrimTime {
    static func text(_ seconds: Double) -> String {
        guard seconds.isFinite else { return "0:00.0" }
        let tenths = Int((max(0, seconds) * 10).rounded())
        return String(format: "%d:%02d.%d", tenths / 600, (tenths / 10) % 60, tenths % 10)
    }

    /// A length, in the unit a person would say it in.
    static func length(_ seconds: Double) -> String {
        guard seconds.isFinite, seconds >= 0 else { return "0s" }
        if seconds < 60 { return String(format: "%.1fs", seconds) }
        return text(seconds)
    }
}
