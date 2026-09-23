import Foundation

enum CalendarViewMode: String, CaseIterable, Identifiable {
    case month, week
    var id: String { rawValue }
    var label: String { self == .month ? "Month" : "Week" }
}

/// Pure date math for the content calendar, in the viewer's local time (a post
/// at 9am shows on that local day). Weeks start on Sunday, as on the web.
struct CalendarDates {
    var calendar: Calendar

    init(timeZone: TimeZone = .current) {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        calendar.firstWeekday = 1
        self.calendar = calendar
    }

    func startOfDay(_ date: Date) -> Date { calendar.startOfDay(for: date) }

    func addDays(_ date: Date, _ days: Int) -> Date {
        calendar.date(byAdding: .day, value: days, to: date) ?? date
    }

    func addMonths(_ date: Date, _ months: Int) -> Date {
        calendar.date(byAdding: .month, value: months, to: date) ?? date
    }

    func sameDay(_ a: Date, _ b: Date) -> Bool { calendar.isDate(a, inSameDayAs: b) }

    func sameMonth(_ date: Date, as focus: Date) -> Bool {
        calendar.isDate(date, equalTo: focus, toGranularity: .month)
    }

    /// Local YYYY-MM-DD, the key items are bucketed under.
    func dayKey(_ date: Date) -> String {
        let parts = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", parts.year ?? 0, parts.month ?? 0, parts.day ?? 0)
    }

    func startOfWeek(_ date: Date) -> Date {
        let day = startOfDay(date)
        let weekday = calendar.component(.weekday, from: day)
        return addDays(day, -(weekday - calendar.firstWeekday))
    }

    /// The seven days of the week holding `focus`, Sunday first.
    func weekDays(_ focus: Date) -> [Date] {
        let start = startOfWeek(focus)
        return (0..<7).map { addDays(start, $0) }
    }

    /// Whole weeks covering the month of `focus`, padded with the days around it.
    func monthWeeks(_ focus: Date) -> [[Date]] {
        let parts = calendar.dateComponents([.year, .month], from: focus)
        guard let first = calendar.date(from: parts),
              let last = calendar.date(byAdding: DateComponents(month: 1, day: -1), to: first)
        else { return [weekDays(focus)] }
        var weeks: [[Date]] = []
        var cursor = startOfWeek(first)
        while cursor <= last {
            weeks.append((0..<7).map { addDays(cursor, $0) })
            cursor = addDays(cursor, 7)
        }
        return weeks
    }

    func monthLabel(_ date: Date) -> String {
        date.formatted(Date.FormatStyle(timeZone: calendar.timeZone).month(.wide).year())
    }

    /// "Sep 20 - Sep 26, 2026"
    func weekLabel(_ focus: Date) -> String {
        let days = weekDays(focus)
        let style = Date.FormatStyle(timeZone: calendar.timeZone).month(.abbreviated).day()
        return "\(days[0].formatted(style)) - \(days[6].formatted(style.year()))"
    }

    /// Items by local day, each day sorted by time. Undated items are dropped.
    func bucketByDay(_ items: [CalendarItem]) -> [String: [CalendarItem]] {
        var map: [String: [(Date, CalendarItem)]] = [:]
        for item in items {
            guard let date = item.scheduledDate else { continue }
            map[dayKey(date), default: []].append((date, item))
        }
        return map.mapValues { $0.sorted { $0.0 < $1.0 }.map(\.1) }
    }

    /// Moving an item to `day` keeps its time of day, or 9am if it had none.
    func rescheduled(_ current: Date?, to day: Date) -> Date {
        let base = startOfDay(day)
        let time = current.map { calendar.dateComponents([.hour, .minute], from: $0) }
        return calendar.date(
            bySettingHour: time?.hour ?? 9, minute: time?.minute ?? 0, second: 0, of: base
        ) ?? base
    }
}
