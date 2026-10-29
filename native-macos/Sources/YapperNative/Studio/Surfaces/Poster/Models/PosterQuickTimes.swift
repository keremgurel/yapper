import Foundation

/// The schedule shortcuts the web Poster offers: tomorrow morning, tomorrow
/// evening, and Saturday morning when Saturday is not already tomorrow.
enum PosterQuickTimes {
    struct Option: Equatable {
        let label: String
        let date: Date
    }

    static func options(from now: Date, calendar: Calendar = .current) -> [Option] {
        let today = calendar.startOfDay(for: now)
        guard let tomorrow = calendar.date(byAdding: .day, value: 1, to: today) else { return [] }
        var options = [
            at(tomorrow, hour: 9, label: "Tomorrow, 9:00 AM", calendar: calendar),
            at(tomorrow, hour: 18, label: "Tomorrow, 6:00 PM", calendar: calendar),
        ].compactMap { $0 }
        if let saturday = calendar.nextDate(after: today, matching: DateComponents(weekday: 7), matchingPolicy: .nextTime),
           !calendar.isDate(saturday, inSameDayAs: tomorrow),
           let option = at(saturday, hour: 10, label: "\(saturday.formatted(.dateTime.weekday(.abbreviated))), 10:00 AM", calendar: calendar) {
            options.append(option)
        }
        return options
    }

    /// "Tue, Oct 28, 9:00 AM", the way the publish button names a time.
    static func label(_ date: Date) -> String {
        date.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day().hour().minute())
    }

    private static func at(_ day: Date, hour: Int, label: String, calendar: Calendar) -> Option? {
        calendar.date(bySettingHour: hour, minute: 0, second: 0, of: day).map { Option(label: label, date: $0) }
    }
}
