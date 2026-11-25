import SwiftUI

/// How Poster prints counts, days and schedule times on its video tiles.
enum PosterFormat {
    static func statusTone(_ status: String) -> NativeChip.Tone {
        switch status {
        case "drafting": .cyan
        case "ready": .yellow
        case "posted": .green
        default: .neutral
        }
    }

    static func views(_ count: Int) -> String {
        if count >= 1_000_000 { return String(format: "%.1fM", Double(count) / 1_000_000) }
        if count >= 1_000 { return String(format: "%.1fK", Double(count) / 1_000) }
        return String(count)
    }

    static func date(_ iso: String?) -> Date? {
        guard let iso else { return nil }
        let precise = ISO8601DateFormatter()
        precise.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return precise.date(from: iso) ?? ISO8601DateFormatter().date(from: iso)
    }

    static func day(_ iso: String) -> String {
        date(iso)?.formatted(.dateTime.month(.abbreviated).day()) ?? ""
    }

    static func scheduled(_ iso: String?) -> String {
        guard let date = date(iso) else { return "Not scheduled" }
        return date.formatted(.dateTime.month(.abbreviated).day().hour().minute())
    }
}
