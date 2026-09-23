import SwiftUI

/// The week grid: seven tall day columns, each under its own dated header.
struct CalendarWeekGrid: View {
    let focus: Date
    let byDay: [String: [CalendarItem]]
    let dates: CalendarDates
    let onOpen: (String) -> Void
    let onDrop: (String, Date) -> Void

    var body: some View {
        let today = Date()
        HStack(spacing: 0) {
            ForEach(Array(dates.weekDays(focus).enumerated()), id: \.element) { index, day in
                let isToday = dates.sameDay(day, today)
                VStack(spacing: 0) {
                    VStack(spacing: 2) {
                        Text(day.formatted(.dateTime.weekday(.abbreviated)))
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(.secondary)
                        Text(day.formatted(.dateTime.day()))
                            .font(.system(size: 13, weight: isToday ? .semibold : .regular).monospacedDigit())
                            .foregroundStyle(isToday ? Color.editorBackground : Color.primary)
                            .frame(minWidth: 22, minHeight: 22)
                            .background { if isToday { Circle().fill(Color.primary) } }
                    }
                    .padding(.vertical, 8)
                    .frame(maxWidth: .infinity)
                    .background(Color.studioFaintFill)
                    .calendarGridLine(edge: .bottom)
                    CalendarDayCell(
                        day: day,
                        items: byDay[dates.dayKey(day)] ?? [],
                        isToday: isToday,
                        dense: false,
                        showDate: false,
                        onOpen: onOpen,
                        onDrop: onDrop
                    )
                }
                .calendarGridLine(edge: .trailing, visible: index < 6)
            }
        }
        .fixedSize(horizontal: false, vertical: true)
        .calendarGridFrame()
    }
}
