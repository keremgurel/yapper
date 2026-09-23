import Foundation

/// One row from `GET /api/content` or `GET /api/ideas`. Both routes list the
/// same content items; Home only reads the fields it shows.
struct HomeItem: Decodable, Equatable, Identifiable {
    let id: String
    let title: String
    let status: String
    let scheduledFor: String?
    let sourceTitle: String?
    let originalNote: String
    let updatedAt: String

    /// The creator's own words, falling back the way the web row does.
    var displayTitle: String {
        [title, sourceTitle ?? "", originalNote].first { !$0.isEmpty } ?? "Untitled idea"
    }

    var isDated: Bool { status == "ready" && scheduledFor != nil }
}

struct HomeItemsResponse: Decodable, Equatable {
    let items: [HomeItem]
}

/// A post on a connected platform, from `GET /api/publish/<platform>/videos`.
/// Providers sometimes omit a field despite the type, so every read is lenient.
struct HomeVideo: Decodable, Equatable, Identifiable {
    let id: String
    let title: String
    let thumbnail: String?
    let viewCount: Int
    let url: String

    private enum CodingKeys: String, CodingKey { case id, title, thumbnail, viewCount, url }

    init(id: String, title: String, thumbnail: String?, viewCount: Int, url: String) {
        self.id = id
        self.title = title
        self.thumbnail = thumbnail
        self.viewCount = viewCount
        self.url = url
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        if let text = try? c.decode(String.self, forKey: .id) {
            id = text
        } else {
            id = String(try c.decode(Int.self, forKey: .id))
        }
        title = (try? c.decodeIfPresent(String.self, forKey: .title)) ?? ""
        thumbnail = try? c.decodeIfPresent(String.self, forKey: .thumbnail)
        let views = (try? c.decodeIfPresent(Double.self, forKey: .viewCount)) ?? 0
        viewCount = views.isFinite ? Int(max(0, views)) : 0
        url = (try? c.decodeIfPresent(String.self, forKey: .url)) ?? ""
    }
}

struct HomeVideosResponse: Decodable, Equatable {
    let connected: Bool
    let videos: [HomeVideo]
}

/// One platform's channel history, or the fact that it failed to load.
struct HomeChannel: Equatable {
    let platform: PublishPlatform
    let connected: Bool
    let videos: [HomeVideo]
    let failed: Bool

    var totalViews: Int { videos.reduce(0) { $0 + $1.viewCount } }
}

/// A video with the platform it came from, for ranking across channels.
struct HomeRankedVideo: Equatable, Identifiable {
    let platform: PublishPlatform
    let video: HomeVideo
    var id: String { "\(platform.rawValue)-\(video.id)" }
}

/// One of the five prompts for today. Saved ideas carry their id so a click
/// opens that idea; the rest are starters that become a new idea.
struct HomeDailyIdea: Equatable, Identifiable {
    let title: String
    let itemID: String?
    var id: String { title }
}

struct HomeCreatedIdea: Decodable, Equatable {
    struct Item: Decodable, Equatable { let id: String }
    let item: Item
}
