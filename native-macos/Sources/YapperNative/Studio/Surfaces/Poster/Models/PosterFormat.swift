import Foundation

enum PosterFormat {
    static func statusTone(_ status: String) -> NativeChip.Tone {
        switch status {
        case "drafting": .cyan
        case "ready": .yellow
        case "posted": .green
        default: .neutral
        }
    }

    static func date(_ iso: String?) -> Date? {
        guard let iso else { return nil }
        let precise = ISO8601DateFormatter()
        precise.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return precise.date(from: iso) ?? ISO8601DateFormatter().date(from: iso)
    }
}
