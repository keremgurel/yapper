import Foundation

/// Where one scheduled post is in its sending life.
enum ScheduleStatus: String, Codable, Equatable {
    case scheduled, running, published, draft, failed
    case needsAttention = "needs_attention"
    case cancelled

    /// Calendar's wording.
    var label: String {
        switch self {
        case .scheduled: "Scheduled"
        case .running: "Sending"
        case .published: "Published"
        case .draft: "In TikTok drafts"
        case .failed: "Needs a retry"
        case .needsAttention: "Check the platform"
        case .cancelled: "Cancelled"
        }
    }

    /// Automations' wording for the same states, as a delivery.
    var deliveryLabel: String {
        self == .scheduled ? "Waiting to send" : label
    }

    var isActive: Bool { self == .scheduled || self == .running }

    var tone: NativeChip.Tone {
        switch self {
        case .scheduled: .blue
        case .running: .cyan
        case .published: .green
        case .draft, .needsAttention: .yellow
        case .failed: .red
        case .cancelled: .neutral
        }
    }
}

/// One post queued to send to one platform (`ScheduleSummary` on the web).
struct ScheduleSummary: Codable, Equatable, Identifiable {
    let id: String
    let platform: String
    let accountLabel: String
    let title: String
    let scheduledFor: String
    let timezone: String
    let status: ScheduleStatus
    let error: String?
    let externalUrl: String?
    let contentItemId: String?

    var scheduledDate: Date? { StudioISODate.parse(scheduledFor) }

    var platformLabel: String {
        PublishPlatform(rawValue: platform)?.label ?? platform.capitalized
    }

    /// Only an https link is opened, as on the web.
    var postURL: URL? {
        guard let externalUrl, externalUrl.hasPrefix("https://") else { return nil }
        return URL(string: externalUrl)
    }
}

/// GET /api/publish/schedules
struct SchedulesResponse: Codable, Equatable {
    let enabled: Bool
    let schedules: [ScheduleSummary]
}

/// PATCH /api/publish/schedules/[id]
struct ScheduleChangeResponse: Codable, Equatable {
    let schedule: ScheduleSummary
}

enum ScheduleAction: String, Encodable {
    case cancel, reschedule, retry
}

struct ScheduleChangeRequest: Encodable {
    let action: ScheduleAction
    let scheduledFor: String?
}
