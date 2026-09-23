import Foundation

/// One library row from `GET /api/content?surface=poster`. Only the fields the
/// Poster reads; the route sends more.
struct PosterContentItem: Codable, Equatable, Identifiable {
    let id: String
    let title: String
    let status: String
    let scheduledFor: String?
    let submissionId: String?
    let transcriptStatus: String?
    let updatedAt: String
}

struct PosterContentList: Codable, Equatable {
    let items: [PosterContentItem]
}

/// `POST /api/content` and `PATCH /api/content/[id]` both answer `{ item }`.
struct PosterContentEnvelope: Codable, Equatable {
    let item: PosterContentItem
}

/// A post already on a connected channel, from `/api/publish/<platform>/videos`.
struct PosterPlatformVideo: Codable, Equatable, Identifiable {
    let id: String
    let title: String
    let caption: String?
    let thumbnail: String?
    let viewCount: Int
    let publishedAt: String
    let url: String
    let privacyStatus: String?
    let durationSec: Double?
    let sourceFileUrl: String?
    let mediaKey: String?
}

struct PosterPlatformVideos: Codable, Equatable {
    let connected: Bool
    let videos: [PosterPlatformVideo]
}

/// A platform connection, with the account id the publish routes check.
struct PosterConnection: Codable, Equatable {
    let platform: String
    let handle: String?
    let externalAccountId: String?
    let status: String
    let updatedAt: String
}

struct PosterConnections: Codable, Equatable {
    let connections: [PosterConnection]
    let available: [String]
}
