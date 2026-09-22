import Foundation

enum PublishPlatform: String, Codable, CaseIterable, Identifiable {
    case youtube, tiktok, instagram, facebook
    var id: String { rawValue }

    var label: String {
        switch self {
        case .youtube: "YouTube"
        case .tiktok: "TikTok"
        case .instagram: "Instagram"
        case .facebook: "Facebook"
        }
    }

    /// What connecting lets Yapper do there, shown until it is connected.
    var postMeaning: String {
        switch self {
        case .youtube: "Posts a public Short."
        case .tiktok: "Posts to TikTok with the audience and settings you choose."
        case .instagram: "Posts a Reel (needs a Business or Creator account)."
        case .facebook: "Posts a public Reel to the Facebook Page you choose."
        }
    }

    var symbol: String {
        switch self {
        case .youtube: "play.rectangle"
        case .tiktok: "music.note"
        case .instagram: "camera"
        case .facebook: "person.2"
        }
    }
}

struct ConnectionSummary: Codable, Equatable {
    let platform: String
    let handle: String?
    let status: String
    let updatedAt: String
}

struct ConnectionsResponse: Codable, Equatable {
    let connections: [ConnectionSummary]
    let available: [String]
}
