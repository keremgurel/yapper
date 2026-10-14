import Foundation

/// A post as it went out on one day: a single video, or the same video
/// cross-posted to several platforms, which reads as one thing on a calendar.
struct CalendarPostedGroup: Equatable, Identifiable {
    let id: String
    let title: String
    var thumbnail: String?
    var views: Int
    var publishedAt: String
    /// Each platform's copy, most viewed first.
    var posts: [HomeRankedVideo]
}

/// What already went out on the connected channels, by local day. The same
/// rules as the web's `posted-days.ts`.
enum CalendarPostedDays {
    /// Past posts bucketed by the local day they went out, with same-day
    /// cross-posts merged into one group. Future-dated rows (a scheduled
    /// YouTube premiere) are left out: the calendar already shows what is
    /// planned. Each day's groups are ordered by time.
    static func bucket(_ videos: [HomeRankedVideo], now: Date, dates: CalendarDates) -> [String: [CalendarPostedGroup]] {
        var days: [String: [CalendarPostedGroup]] = [:]
        for video in videos {
            guard let at = video.video.publishedDate, at <= now else { continue }
            let day = dates.dayKey(at)
            var groups = days[day] ?? []
            // Untitled posts never merge: an empty key would glue strangers together.
            let title = video.video.title
            let key = titleKey(title).isEmpty ? "\(video.platform.rawValue):\(video.video.id)" : titleKey(title)
            if let index = groups.firstIndex(where: { $0.id == key }),
               !groups[index].posts.contains(where: { $0.platform == video.platform }) {
                groups[index].posts.append(video)
                groups[index].views += video.video.viewCount
                groups[index].thumbnail = groups[index].thumbnail ?? video.video.thumbnail
                groups[index].publishedAt = min(groups[index].publishedAt, video.video.publishedAt)
            } else {
                let taken = groups.contains { $0.id == key }
                groups.append(CalendarPostedGroup(
                    id: taken ? "\(key):\(video.platform.rawValue):\(video.video.id)" : key,
                    title: title.trimmingCharacters(in: .whitespacesAndNewlines),
                    thumbnail: video.video.thumbnail,
                    views: video.video.viewCount,
                    publishedAt: video.video.publishedAt,
                    posts: [video]
                ))
            }
            days[day] = groups
        }
        return days.mapValues { groups in
            groups
                .map { group in
                    var sorted = group
                    sorted.posts.sort { $0.video.viewCount > $1.video.viewCount }
                    return sorted
                }
                .sorted { $0.publishedAt < $1.publishedAt }
        }
    }

    /// Titles match across platforms when they agree on their first words.
    /// Captions get hashtags and line breaks appended per platform, so the
    /// head of the text is the part that survives a cross-post.
    static func titleKey(_ title: String) -> String {
        let withoutTags = title.lowercased().replacingOccurrences(of: #"#\S+"#, with: "", options: .regularExpression)
        let words = withoutTags.replacingOccurrences(of: #"[^\p{L}\p{N}]+"#, with: " ", options: .regularExpression)
        return String(words.trimmingCharacters(in: .whitespaces).prefix(40))
    }
}
