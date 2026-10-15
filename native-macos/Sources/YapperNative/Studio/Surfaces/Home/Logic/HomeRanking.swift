import Foundation

/// Pure reads over the loaded channels and ideas, mirroring the web Home's
/// helpers so both apps show the same numbers and the same order.
enum HomeRanking {
    /// Every loaded video across all channels, most viewed first.
    static func rankVideos(_ channels: [HomeChannel]?) -> [HomeRankedVideo] {
        (channels ?? [])
            .flatMap { channel in channel.videos.map { HomeRankedVideo(platform: channel.platform, video: $0) } }
            .sorted { $0.video.viewCount > $1.video.viewCount }
    }

    /// The latest posts, newest first.
    static func latest(_ ranked: [HomeRankedVideo], limit: Int = 4) -> [HomeRankedVideo] {
        Array(ranked.sorted { $0.video.publishedAt > $1.video.publishedAt }.prefix(limit))
    }

    /// The rows Home surfaces first: dated work in date order, then the most
    /// recently touched drafts. Posted items are finished and stay out.
    static func upNext(_ items: [IdeaItem], limit: Int = 5) -> [IdeaItem] {
        let active = items.filter { $0.status != "posted" }
        let dated = active.filter(isDated).sorted { ($0.scheduledFor ?? "") < ($1.scheduledFor ?? "") }
        let undated = active.filter { !isDated($0) }.sorted { $0.updatedAt > $1.updatedAt }
        return Array((dated + undated).prefix(limit))
    }

    static func isDated(_ item: IdeaItem) -> Bool {
        item.status == "ready" && item.scheduledFor != nil
    }

    /// Connected if either source says so: the videos read (the token worked
    /// just now) or the stored connection row (history is still loading).
    static func isConnected(
        _ platform: PublishPlatform,
        channels: [HomeChannel]?,
        connections: [ConnectionSummary]?
    ) -> Bool {
        (channels ?? []).contains { $0.platform == platform && $0.connected }
            || (connections ?? []).contains { $0.platform == platform.rawValue && $0.status == "active" }
    }
}

/// Dashboard counts: 1234 reads "1.2K", below 1000 stays exact.
enum HomeNumber {
    static func compact(_ value: Int) -> String {
        if value >= 1_000 {
            return value.formatted(.number.notation(.compactName).precision(.fractionLength(0...1)))
        }
        return value.formatted(.number)
    }

    /// "3.2×" under ten, "12×" from ten up, and "<0.1×" for a post far below
    /// the typical one, which would otherwise read "0.0×". Same as the web.
    static func multiplier(_ times: Double) -> String {
        if times < 0.1 { return "<0.1×" }
        return times >= 10 ? "\(Int(times.rounded()))×" : String(format: "%.1f×", times)
    }
}
