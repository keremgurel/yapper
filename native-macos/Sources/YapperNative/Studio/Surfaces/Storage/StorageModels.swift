import Foundation

/// `GET /api/storage`: what the Storage page shows, computed on the server
/// exactly as the web page computes it.
struct StorageUsage: Codable, Equatable {
    struct Plan: Codable, Equatable {
        let key: String
        let name: String
    }

    struct MediaBucket: Codable, Equatable {
        let bytes: Double
        let count: Int
    }

    struct Media: Codable, Equatable {
        let recording: MediaBucket
        let `import`: MediaBucket
        let thumbnail: MediaBucket
        let brandLogo: MediaBucket
    }

    struct Workspace: Codable, Equatable {
        let estimatedBytes: Double
        let brainBlocks: Int
        let brainSkills: Int
        let contentIdeas: Int
        let contentLibrary: Int
        let savedViews: Int
    }

    struct PlanOption: Codable, Equatable, Identifiable {
        let key: String
        let name: String
        let storageBytes: Double
        let storageLabel: String
        var id: String { key }
    }

    enum Pressure: String, Codable, Equatable {
        case roomy, near, critical

        var label: String {
            switch self {
            case .roomy: "Plenty of room"
            case .near: "Getting full"
            case .critical: "Storage almost full"
            }
        }
    }

    let plan: Plan?
    let usedBytes: Double
    let reservedBytes: Double
    let reservedCount: Int
    let committedBytes: Double
    let quotaBytes: Double
    let percent: Double
    let pressure: Pressure
    let media: Media
    let workspace: Workspace
    let plans: [PlanOption]

    var freeBytes: Double { max(0, quotaBytes - committedBytes) }

    /// What a plan would leave free at today's usage.
    func headroom(on option: PlanOption) -> Double {
        max(0, option.storageBytes - committedBytes)
    }
}
