import Foundation

/// Where a repurposed Instagram video can go.
enum AutomationDestination: String, Codable, CaseIterable, Identifiable {
    case youtube, tiktok
    var id: String { rawValue }

    var label: String { self == .youtube ? "YouTube" : "TikTok" }

    /// What the destination receives.
    var delivery: String {
        self == .tiktok ? "Drafts to finish in TikTok" : "Requested as public"
    }
}

struct AutomationSettings: Codable, Equatable {
    var destinations: [AutomationDestination]
    var stripHashtags: Bool
    var reformatForYouTube: Bool

    static let defaults = AutomationSettings(
        destinations: [.youtube, .tiktok], stripHashtags: true, reformatForYouTube: true
    )
}

struct AutomationAccount: Codable, Equatable {
    let platform: AutomationDestination
    let id: String
    let label: String
}

/// The saved rule (`AutomationSummary` on the web).
struct AutomationRule: Codable, Equatable {
    let id: String
    let version: Int
    let enabled: Bool
    let settings: AutomationSettings
    let sourceLabel: String?
    let accounts: [AutomationAccount]
    let enabledAt: String?
    let lastCheckedAt: String?
    let error: String?
}

enum AutomationRunStatus: String, Codable, Equatable {
    case pending, importing, queued, failed, cancelled

    var label: String {
        switch self {
        case .pending: "Waiting to import"
        case .importing: "Importing video"
        case .queued: "Prepared for sending"
        case .failed: "Import needs attention"
        case .cancelled: "Cancelled"
        }
    }
}

/// One new Instagram video the rule picked up, and where it was sent.
struct AutomationRun: Codable, Equatable, Identifiable {
    let id: String
    let title: String
    let sourceUrl: String
    let status: AutomationRunStatus
    let error: String?
    let createdAt: String
    let schedules: [ScheduleSummary]

    var sourceURL: URL? {
        sourceUrl.hasPrefix("https://") ? URL(string: sourceUrl) : nil
    }
}

/// GET /api/publish/automations
struct AutomationResponse: Codable, Equatable {
    var available: Bool
    var setupAvailable: Bool?
    var rule: AutomationRule?
    var runs: [AutomationRun]
}

/// PUT /api/publish/automations body.
struct AutomationSaveRequest: Encodable {
    let enabled: Bool
    let version: Int
    let settings: AutomationSettings
    let expectedAccounts: [String: String]
}

/// PUT /api/publish/automations reply.
struct AutomationSaveResponse: Codable, Equatable {
    let rule: AutomationRule
}

/// POST /api/publish/automations/runs/[id] reply.
struct AutomationRetryResponse: Codable, Equatable {
    let ok: Bool
}

/// A connection as the automation needs it: the account id the save must
/// name, which the Connections page doesn't read.
struct AutomationConnection: Codable, Equatable {
    let platform: String
    let handle: String?
    let status: String
    let externalAccountId: String?
}

/// GET /api/publish/connections, read for account ids.
struct AutomationConnectionsResponse: Codable, Equatable {
    let connections: [AutomationConnection]
}
