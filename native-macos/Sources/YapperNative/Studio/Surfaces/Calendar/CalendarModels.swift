import Foundation

/// The pipeline stage of a library item, which colours its calendar dot.
enum CalendarItemStatus: String, Codable, Equatable {
    case captured, drafting, ready, posted

    var tone: NativeChip.Tone {
        switch self {
        case .captured: .neutral
        case .drafting: .cyan
        case .ready: .yellow
        case .posted: .green
        }
    }
}

/// The fields of a library row (`ContentSummary` on the web) the calendar
/// reads. The route sends more; the rest is ignored.
struct CalendarItem: Codable, Equatable, Identifiable {
    let id: String
    let title: String
    let status: CalendarItemStatus
    var scheduledFor: String?
    let submissionId: String?

    var scheduledDate: Date? { StudioISODate.parse(scheduledFor) }

    var displayTitle: String {
        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? "Untitled" : trimmed
    }
}

/// GET /api/content
struct CalendarItemsResponse: Codable, Equatable {
    let items: [CalendarItem]
}

/// PATCH /api/content/[id] answers with the saved row.
struct CalendarItemResponse: Codable, Equatable {
    let item: CalendarItem
}

/// PATCH /api/content/[id] body for a reschedule.
struct CalendarReschedulePatch: Encodable {
    let scheduledFor: String
}
