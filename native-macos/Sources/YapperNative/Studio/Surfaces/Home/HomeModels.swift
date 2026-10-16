import Foundation

/// A post on a connected platform, from `GET /api/publish/<platform>/videos`.
/// Providers sometimes omit a field despite the type, so every read is lenient.
struct HomeVideo: Decodable, Equatable, Identifiable {
    let id: String
    let title: String
    let mediaKey: String?
    let caption: String?
    let thumbnail: String?
    let viewCount: Int
    let publishedAt: String
    let url: String

    /// The title, then the caption, the way the web card falls back.
    var displayTitle: String {
        [title, caption ?? ""].first { !$0.isEmpty } ?? "Untitled"
    }

    var publishedDate: Date? { IdeaDates.parse(publishedAt) }

    private enum CodingKeys: String, CodingKey { case id, title, mediaKey, caption, thumbnail, viewCount, publishedAt, url }

    init(
        id: String,
        title: String,
        caption: String? = nil,
        mediaKey: String? = nil,
        thumbnail: String?,
        viewCount: Int,
        publishedAt: String = "",
        url: String
    ) {
        self.id = id
        self.title = title
        self.caption = caption
        self.mediaKey = mediaKey
        self.thumbnail = thumbnail
        self.viewCount = viewCount
        self.publishedAt = publishedAt
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
        mediaKey = try? c.decodeIfPresent(String.self, forKey: .mediaKey)
        caption = try? c.decodeIfPresent(String.self, forKey: .caption)
        thumbnail = try? c.decodeIfPresent(String.self, forKey: .thumbnail)
        let views = (try? c.decodeIfPresent(Double.self, forKey: .viewCount)) ?? 0
        viewCount = views.isFinite ? Int(max(0, views)) : 0
        publishedAt = (try? c.decodeIfPresent(String.self, forKey: .publishedAt)) ?? ""
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
}

/// A video with the platform it came from, for ranking across channels.
struct HomeRankedVideo: Equatable, Identifiable {
    let platform: PublishPlatform
    let video: HomeVideo
    var id: String { "\(platform.rawValue)-\(video.id)" }
}
