import SwiftUI

/// One day in the grid: its date, its posts, and a drop target for
/// drag-to-reschedule. Month cells cap the chips at three; week cells show
/// all of them and leave the date to the column header.
struct CalendarDayCell: View {
    let day: Date
    let items: [CalendarItem]
    var inMonth = true
    var isToday = false
    var dense = true
    var showDate = true
    let onOpen: (String) -> Void
    let onDrop: (String, Date) -> Void
    var onShowMore: ((Date) -> Void)?

    @State private var targeted = false

    private var shown: ArraySlice<CalendarItem> { items.prefix(dense ? 3 : items.count) }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            if showDate { dateMark }
            ForEach(shown) { item in
                CalendarPostChip(item: item) { onOpen(item.id) }
            }
            if items.count > shown.count { moreLink }
            Spacer(minLength: 0)
        }
        .padding(6)
        .frame(maxWidth: .infinity, minHeight: dense ? 96 : 416, maxHeight: .infinity, alignment: .topLeading)
        .background(inMonth ? Color.clear : Color.studioFaintFill)
        .overlay {
            if targeted {
                Rectangle().strokeBorder(Color.yapperOrange, lineWidth: 2)
            }
        }
        .contentShape(Rectangle())
        .dropDestination(for: String.self) { ids, _ in
            guard let id = ids.first else { return false }
            onDrop(id, day)
            return true
        } isTargeted: { targeted = $0 }
    }

    @ViewBuilder
    private var dateMark: some View {
        let number = Text(day.formatted(.dateTime.day()))
            .font(.system(size: 11, weight: .semibold).monospacedDigit())
        if isToday {
            number
                .foregroundStyle(Color.editorBackground)
                .frame(width: 20, height: 20)
                .background(Circle().fill(Color.primary))
                .accessibilityLabel("Today, \(day.formatted(date: .complete, time: .omitted))")
        } else {
            number
                .foregroundStyle(inMonth ? Color.primary : Color.secondary.opacity(0.6))
                .frame(height: 20)
        }
    }

    @ViewBuilder
    private var moreLink: some View {
        let label = Text("+\(items.count - shown.count) more")
            .font(.system(size: 11, weight: .medium))
            .foregroundStyle(.secondary)
            .padding(.horizontal, 4)
        if let onShowMore {
            Button { onShowMore(day) } label: { label }
                .buttonStyle(.studioPlain)
                .help("Show this week")
        } else {
            label
        }
    }
}
