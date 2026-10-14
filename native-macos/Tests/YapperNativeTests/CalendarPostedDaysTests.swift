import Foundation
import Testing
@testable import YapperNative

/// The web's `posted-days.test.ts` cases, so the calendar groups posts the
/// same way in both apps.
@Suite
struct CalendarPostedDaysTests {
    private let dates = CalendarDates()
    private var day: Date { dates.calendar.date(from: DateComponents(year: 2026, month: 10, day: 3, hour: 10))! }
    private var now: Date { dates.calendar.date(from: DateComponents(year: 2026, month: 10, day: 10))! }

    private func post(
        _ platform: PublishPlatform = .youtube,
        id: String = "1",
        title: String = "How I edit in ten minutes",
        views: Int = 100,
        at: Date? = nil,
        publishedAt: String? = nil
    ) -> HomeRankedVideo {
        HomeRankedVideo(platform: platform, video: HomeVideo(
            id: id, title: title, thumbnail: nil, viewCount: views,
            publishedAt: publishedAt ?? ISO8601DateFormatter().string(from: at ?? day),
            url: "https://example.com/\(id)"
        ))
    }

    @Test func mergesASameDayCrossPost() {
        let groups = CalendarPostedDays.bucket([
            post(),
            post(.tiktok, id: "2", title: "How I edit in ten minutes #editing #creator", views: 900),
        ], now: now, dates: dates)[dates.dayKey(day)] ?? []
        #expect(groups.count == 1)
        #expect(groups.first?.views == 1000)
        #expect(groups.first?.posts.map(\.platform) == [.tiktok, .youtube])
    }

    @Test func keepsTwoPostsOnOnePlatformApart() {
        let groups = CalendarPostedDays.bucket([post(), post(id: "2")], now: now, dates: dates)[dates.dayKey(day)] ?? []
        #expect(groups.count == 2)
    }

    @Test func neverMergesUntitledPosts() {
        let groups = CalendarPostedDays.bucket([post(title: ""), post(.tiktok, id: "2", title: "")], now: now, dates: dates)[dates.dayKey(day)] ?? []
        #expect(groups.count == 2)
    }

    @Test func dropsFutureAndUnparseableRows() {
        let later = dates.calendar.date(from: DateComponents(year: 2026, month: 10, day: 20))!
        let byDay = CalendarPostedDays.bucket([post(at: later), post(id: "2", publishedAt: "not a date")], now: now, dates: dates)
        #expect(byDay.isEmpty)
    }
}
