import Foundation

/// The social platforms a pasted link can come from, read off its host.
enum LinkPlatform: String, CaseIterable {
    case instagram, tiktok, youtube

    init?(url: String) {
        guard let host = URLComponents(string: url.trimmingCharacters(in: .whitespacesAndNewlines))?.host?.lowercased() else {
            return nil
        }
        func matches(_ domain: String) -> Bool { host == domain || host.hasSuffix("." + domain) }
        if matches("instagram.com") || matches("instagr.am") {
            self = .instagram
        } else if matches("tiktok.com") {
            self = .tiktok
        } else if matches("youtube.com") || matches("youtu.be") {
            self = .youtube
        } else {
            return nil
        }
    }

    var name: String {
        switch self {
        case .instagram: "Instagram"
        case .tiktok: "TikTok"
        case .youtube: "YouTube"
        }
    }
}
