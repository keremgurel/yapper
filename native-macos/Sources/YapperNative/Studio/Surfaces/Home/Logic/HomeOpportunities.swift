import Foundation

struct HomeVideoGroup: Identifiable {
    var posts: [HomeRankedVideo]
    var id: String { posts.map(\.id).sorted().joined(separator: "|") }
    var primary: HomeRankedVideo { posts[0] }
    var views: Int { posts.reduce(0) { $0 + $1.video.viewCount } }
    var publishedAt: String { posts.map { $0.video.publishedAt }.max() ?? "" }
}

struct HomeOpportunity: Identifiable {
    enum Kind { case followUp, share, revisit }
    let kind: Kind
    let group: HomeVideoGroup
    var comparison: (platform: PublishPlatform, times: Double)?
    var missing: [PublishPlatform] = []
    var id: String { "\(kind)-\(group.id)" }
    var heading: String {
        switch kind {
        case .followUp: "Try a follow-up"
        case .share: "Reach another channel"
        case .revisit: "Revisit a strong idea"
        }
    }
    var reason: String {
        if kind == .share {
            return "No matching post found on \(missing.map(\.label).joined(separator: " or ")) in your loaded history. Check before sharing."
        }
        guard let comparison else { return "" }
        let question = kind == .revisit ? "What has changed since you made it?" : "What question could a second video answer?"
        return "\(HomeNumber.multiplier(comparison.times)) your typical \(comparison.platform.label) post by lifetime views. \(question)"
    }
    var captureText: String {
        let prefix = kind == .revisit ? "Revisit" : "A follow-up to"
        let question = kind == .revisit ? "What has changed, and what would I do differently now?" : "Answer the next question this video leaves open."
        return "\(prefix) “\(group.primary.video.displayTitle)”: \(question) (Based on my \(group.primary.platform.label) video.)"
    }
}

/// Mirrors content-opportunities.ts. Metadata matching is deliberately
/// conservative; lifetime views never stand in for views gained this week.
enum HomeOpportunities {
    private static let day: TimeInterval = 86_400
    private static func titleKey(_ video: HomeVideo) -> String {
        video.displayTitle.components(separatedBy: "\n")[0]
            .replacingOccurrences(of: #"https?://\S+|#[\p{L}\p{N}_]+"#, with: "", options: .regularExpression)
            .precomposedStringWithCompatibilityMapping.lowercased()
            .replacingOccurrences(of: #"[^\p{L}\p{N}]+"#, with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }
    static func sameVideo(_ a: HomeRankedVideo, _ b: HomeRankedVideo) -> Bool {
        guard a.platform != b.platform else { return false }
        if let left = a.video.mediaKey, !left.isEmpty, let right = b.video.mediaKey, !right.isEmpty { return left == right }
        guard let leftDate = a.video.publishedDate, let rightDate = b.video.publishedDate,
              abs(leftDate.timeIntervalSince(rightDate)) <= 7 * day else { return false }
        let left = titleKey(a.video), right = titleKey(b.video)
        guard min(left.count, right.count) >= 16 else { return false }
        if left == right { return true }
        let short = left.count < right.count ? left : right
        let long = left.count < right.count ? right : left
        return short.count >= 48 && long.hasPrefix(short + " ")
    }
    static func groups(_ videos: [HomeRankedVideo]) -> [HomeVideoGroup] {
        var groups: [HomeVideoGroup] = []
        var seen: Set<String> = []
        for video in videos.sorted(by: { $0.video.viewCount == $1.video.viewCount ? $0.id < $1.id : $0.video.viewCount > $1.video.viewCount }) {
            guard seen.insert(video.id).inserted else { continue }
            if let index = groups.firstIndex(where: { group in
                !group.posts.contains { $0.platform == video.platform } && group.posts.contains { sameVideo($0, video) }
            }) {
                groups[index].posts.append(video)
            } else {
                groups.append(HomeVideoGroup(posts: [video]))
            }
        }
        return groups.sorted { $0.views == $1.views ? $0.id < $1.id : $0.views > $1.views }
    }
    static func suggestions(_ groups: [HomeVideoGroup], videos: [HomeRankedVideo], connected: [PublishPlatform], now: Date, rotation: Int = 0) -> [HomeOpportunity] {
        func age(_ value: String) -> Double { IdeaDates.parse(value).map { now.timeIntervalSince($0) / day } ?? -.infinity }
        func comparison(_ group: HomeVideoGroup) -> (platform: PublishPlatform, times: Double)? {
            group.posts.compactMap { post -> (platform: PublishPlatform, times: Double)? in
                let baseline = videos.filter { $0.platform == post.platform && $0.id != post.id && age($0.video.publishedAt) >= 7 && age($0.video.publishedAt) <= 180 }
                let typical = HomeChannelMath.typicalViews(baseline)
                guard baseline.count >= 5, typical > 0, Double(post.video.viewCount) >= Double(typical) * 1.5 else { return nil }
                return (post.platform, Double(post.video.viewCount) / Double(typical))
            }.max { $0.times < $1.times }
        }
        var used: Set<String> = []
        var result: [HomeOpportunity] = []
        func choose(_ pool: [HomeOpportunity]) {
            let available = pool.filter { !used.contains($0.group.id) }
            guard !available.isEmpty else { return }
            let index = (Int(floor(now.timeIntervalSince1970 / day)) + rotation) % available.count
            let item = available[(index + available.count) % available.count]
            used.insert(item.group.id)
            result.append(item)
        }
        choose(groups.compactMap { group in
            guard age(group.publishedAt) >= 2, age(group.publishedAt) <= 30, let match = comparison(group) else { return nil }
            return HomeOpportunity(kind: .followUp, group: group, comparison: match)
        })
        choose(groups.compactMap { group in
            let missing = connected.filter { platform in !group.posts.contains { $0.platform == platform } }
            guard age(group.publishedAt) >= 2, age(group.publishedAt) <= 30, !missing.isEmpty else { return nil }
            return HomeOpportunity(kind: .share, group: group, missing: missing)
        })
        choose(groups.compactMap { group in
            guard age(group.publishedAt) > 30, age(group.publishedAt) <= 180, let match = comparison(group) else { return nil }
            return HomeOpportunity(kind: .revisit, group: group, comparison: match)
        })
        return result
    }
}
