import Foundation

/// A length of time the way the time-saved card says it, the same as the
/// web's `format-duration.ts`: "72 hr 3 min", "45 min", "2 hr", "Under a
/// minute", and "0 min" for nothing yet.
enum HomeDuration {
    static func text(_ seconds: Double) -> String {
        guard seconds.isFinite, seconds > 0 else { return "0 min" }
        let minutes = Int((seconds / 60).rounded())
        if minutes == 0 { return "Under a minute" }
        let hours = minutes / 60
        let rest = minutes % 60
        if hours == 0 { return "\(rest) min" }
        let hourText = hours.formatted(.number)
        return rest == 0 ? "\(hourText) hr" : "\(hourText) hr \(rest) min"
    }
}
