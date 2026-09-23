import Foundation

/// Which period the calendar shows and how it moves: the view plus the focused
/// date, with previous, next and today.
struct CalendarNavigator: Equatable {
    var mode: CalendarViewMode = .month
    var focus = Date()

    mutating func step(_ direction: Int, dates: CalendarDates) {
        focus = mode == .month
            ? dates.addMonths(focus, direction)
            : dates.addDays(focus, direction * 7)
    }

    mutating func today() { focus = Date() }

    /// Opens the week holding `day`, for a month cell's "+N more".
    mutating func showWeek(of day: Date) {
        mode = .week
        focus = day
    }

    func label(_ dates: CalendarDates) -> String {
        mode == .month ? dates.monthLabel(focus) : dates.weekLabel(focus)
    }
}
