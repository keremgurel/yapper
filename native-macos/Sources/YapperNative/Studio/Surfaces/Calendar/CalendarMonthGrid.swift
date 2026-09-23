import SwiftUI

/// The month grid: a weekday header, then rows of seven day cells.
struct CalendarMonthGrid: View {
    let focus: Date
    let byDay: [String: [CalendarItem]]
    let dates: CalendarDates
    let onOpen: (String) -> Void
    let onDrop: (String, Date) -> Void
    let onShowMore: (Date) -> Void

    var body: some View {
        let today = Date()
        VStack(spacing: 0) {
            HStack(spacing: 0) {
                ForEach(dates.weekDays(focus), id: \.self) { day in
                    Text(day.formatted(.dateTime.weekday(.abbreviated)))
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 8).padding(.vertical, 8)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            .background(Color.studioFaintFill)
            .calendarGridLine(edge: .bottom)
            ForEach(dates.monthWeeks(focus), id: \.first) { week in
                HStack(spacing: 0) {
                    ForEach(Array(week.enumerated()), id: \.element) { index, day in
                        CalendarDayCell(
                            day: day,
                            items: byDay[dates.dayKey(day)] ?? [],
                            inMonth: dates.sameMonth(day, as: focus),
                            isToday: dates.sameDay(day, today),
                            onOpen: onOpen,
                            onDrop: onDrop,
                            onShowMore: onShowMore
                        )
                        .calendarGridLine(edge: .trailing, visible: index < 6)
                    }
                }
                .fixedSize(horizontal: false, vertical: true)
                .calendarGridLine(edge: .bottom, visible: week != dates.monthWeeks(focus).last)
            }
        }
        .calendarGridFrame()
    }
}

extension View {
    /// A hairline on one edge of a grid cell or row.
    func calendarGridLine(edge: Alignment, visible: Bool = true) -> some View {
        overlay(alignment: edge) {
            if visible {
                let vertical = edge == .leading || edge == .trailing
                Rectangle().fill(Color.studioLine)
                    .frame(width: vertical ? 1 : nil, height: vertical ? nil : 1)
            }
        }
    }

    /// The grid's rounded hairline frame.
    func calendarGridFrame() -> some View {
        let shape = RoundedRectangle(cornerRadius: 14, style: .continuous)
        return clipShape(shape).overlay(shape.strokeBorder(Color.studioLine, lineWidth: 1))
    }
}
