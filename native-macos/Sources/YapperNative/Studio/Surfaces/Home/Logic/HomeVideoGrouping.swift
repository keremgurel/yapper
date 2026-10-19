import Foundation

struct HomeVideoGroup: Identifiable {
    var posts: [HomeRankedVideo]
    var id: String { posts.map(\.id).sorted().joined(separator: "|") }
    var primary: HomeRankedVideo { posts[0] }
    var views: Int { posts.reduce(0) { $0 + $1.video.viewCount } }
    var publishedAt: String { posts.map { $0.video.publishedAt }.max() ?? "" }
}

/// Conservative cross-post matching, mirroring group-videos.ts.
enum HomeVideoGrouping {
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
                !group.posts.contains { $0.platform == video.platform } &&
                !group.posts.contains { post in
                    guard let existing = post.video.mediaKey, !existing.isEmpty,
                          let incoming = video.video.mediaKey, !incoming.isEmpty else { return false }
                    return existing != incoming
                } && group.posts.contains { sameVideo($0, video) }
            }) {
                groups[index].posts.append(video)
            } else {
                groups.append(HomeVideoGroup(posts: [video]))
            }
        }
        return groups.sorted { $0.views == $1.views ? $0.id < $1.id : $0.views > $1.views }
    }
}
