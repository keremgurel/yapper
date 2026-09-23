import Foundation

/// Five prompts for today: saved ideas first, then a follow-up to the top
/// performer, then evergreen starters rotated by the calendar day, so the
/// list changes daily without any storage. Same rules as the web Home.
enum HomeDailyIdeas {
    static let starters = [
        "Answer the one question your audience keeps asking incorrectly",
        "Show the fastest way to fix a common beginner mistake",
        "React to advice in your niche that sounds right but is not",
        "Turn a recent client or student win into a three-step lesson",
        "Explain what you would do differently if you started again today",
        "Compare the popular method with the method that actually works",
        "Break down one small detail experts notice immediately",
        "Give your audience a 30-second challenge they can try today",
    ]

    static func make(saved: [HomeItem], topVideo: HomeRankedVideo?, now: Date = Date()) -> [HomeDailyIdea] {
        let savedIdeas = saved.prefix(5).map { HomeDailyIdea(title: $0.displayTitle, itemID: $0.id) }
        let day = dayNumber(now)
        let rotated = starters.indices.map { starters[(day + $0) % starters.count] }
        var candidates = Array(savedIdeas)
        if let title = topVideo?.video.title, !title.isEmpty {
            candidates.append(HomeDailyIdea(title: "Make the useful follow-up your viewers need after \u{201C}\(title)\u{201D}", itemID: nil))
        }
        candidates += rotated.map { HomeDailyIdea(title: $0, itemID: nil) }

        var seen = Set<String>()
        return Array(candidates.filter { seen.insert($0.title).inserted }.prefix(5))
    }

    /// Days since 1970 for the local calendar date, like the web's
    /// `Date.UTC(year, month, day) / 86_400_000`.
    static func dayNumber(_ date: Date) -> Int {
        let local = Calendar.current.dateComponents([.year, .month, .day], from: date)
        var utc = Calendar(identifier: .gregorian)
        utc.timeZone = TimeZone(identifier: "UTC")!
        let midnight = utc.date(from: local) ?? date
        return Int(floor(midnight.timeIntervalSince1970 / 86_400))
    }
}
