import SwiftUI

/// The content calendar: scheduled library items by day, month or week, with
/// drag-to-reschedule. Owns the wiring; the grids render and the date math
/// lives in `CalendarDates`.
struct ContentCalendarView: View {
    @ObservedObject var store: CalendarStore = .shared
    @ObservedObject var rescheduler: CalendarRescheduler = .shared
    @State private var navigator = CalendarNavigator()

    private let dates = CalendarDates()

    var body: some View {
        if store.loadFailed {
            NativeErrorState(message: "Your calendar couldn't be loaded.") {
                Task { await store.refresh() }
            }
        } else if let items = store.items {
            loaded(dates.bucketByDay(items))
        } else {
            NativeLoadingState(label: "Loading your calendar…")
        }
    }

    private func loaded(_ byDay: [String: [CalendarItem]]) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(rescheduler.failedMoves.keys.sorted(), id: \.self) { id in
                NativeErrorState(message: "That date couldn't be saved. The last saved date is shown.") {
                    rescheduler.retry(id)
                }
                .padding(.bottom, 12)
            }
            CalendarHeaderBar(navigator: $navigator, dates: dates)
            grid(byDay)
            if byDay.isEmpty {
                NativeEmptyState(
                    systemImage: "calendar",
                    title: "Nothing scheduled yet",
                    message: "Mark an idea Ready and give it a date, and it shows up here. These are planning dates; nothing publishes on its own."
                )
                .padding(.top, 8)
            } else {
                Text("Drag a post to another day to reschedule it. These are planning dates; they do not publish your video on their own.")
                    .font(.system(size: 12))
                    .foregroundStyle(.secondary)
                    .padding(.top, 12)
            }
        }
    }

    @ViewBuilder
    private func grid(_ byDay: [String: [CalendarItem]]) -> some View {
        let open: (String) -> Void = { StudioNavigation.shared.openIdea($0) }
        let drop: (String, Date) -> Void = { rescheduler.move($0, to: $1, dates: dates) }
        switch navigator.mode {
        case .month:
            CalendarMonthGrid(
                focus: navigator.focus, byDay: byDay, dates: dates,
                onOpen: open, onDrop: drop,
                onShowMore: { navigator.showWeek(of: $0) }
            )
        case .week:
            CalendarWeekGrid(
                focus: navigator.focus, byDay: byDay, dates: dates,
                onOpen: open, onDrop: drop
            )
        }
    }
}
