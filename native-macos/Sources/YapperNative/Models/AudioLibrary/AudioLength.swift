import Foundation

/// How long a sound is, said the way the creator needs to hear it.
///
/// Seconds to one decimal below a minute, because the difference between a
/// 0.2s click and a 0.4s one is the difference between two effects. Minutes
/// above it, because "94.3s" tells nobody whether a bed covers the edit.
enum AudioLength {
    static func short(_ seconds: Double) -> String {
        let whole = Int(seconds.rounded())
        if whole < 60 { return String(format: "%.1fs", max(0, seconds)) }
        return String(format: "%d:%02d", whole / 60, whole % 60)
    }
}
