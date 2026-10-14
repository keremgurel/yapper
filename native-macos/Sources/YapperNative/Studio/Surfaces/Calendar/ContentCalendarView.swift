import SwiftUI

/// The content calendar: scheduled library items by day, month or week, with
/// drag-to-reschedule. Owns the wiring; the grids render and the date math
/// lives in `CalendarDates`.
struct ContentCalendarView: View {
    @ObservedObject var store: CalendarStore = .shared
    @ObservedObject var rescheduler: CalendarRescheduler = .shared
    @ObservedObject var channels: HomeChannelsStore = .shared
    @State private var navigator = CalendarNavigator()
    /// One clock per visit, so a post published while the page is open does
    /// not flicker between days.
    @State private var now = Date()

    private let dates = CalendarDates()

    /// Already-published posts by day, from the same cached channel lists
    /// Home reads. A channel that fails to load just contributes nothing.
    private var postedByDay: [String: [CalendarPostedGroup]] {
        CalendarPostedDays.bucket(HomeRanking.rankVideos(channels.channels), now: now, dates: dates)
    }

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
        let posted = postedByDay
        return VStack(alignment: .leading, spacing: 0) {
            ForEach(rescheduler.failedMoves.keys.sorted(), id: \.self) { id in
                NativeErrorState(message: "That date couldn't be saved. The last saved date is shown.") {
                    rescheduler.retry(id)
                }
                .padding(.bottom, 12)
            }
            CalendarHeaderBar(navigator: $navigator, dates: dates)
            grid(byDay, posted: posted)
            if byDay.isEmpty && posted.isEmpty {
                NativeEmptyState(
                    systemImage: "calendar",
                    title: "Nothing scheduled yet",
                    message: "Mark an idea Ready and give it a date, and it shows up here. These are planning dates; nothing publishes on its own."
                )
                .padding(.top, 8)
            } else {
                Text("Drag a planned post to another day to reschedule it. Outlined badges are posts already live on your channels.")
                    .font(.system(size: 12))
                    .foregroundStyle(.secondary)
                    .padding(.top, 12)
            }
        }
    }

    @ViewBuilder
    private func grid(_ byDay: [String: [CalendarItem]], posted: [String: [CalendarPostedGroup]]) -> some View {
        let open: (String) -> Void = { StudioNavigation.shared.openIdea($0) }
        let drop: (String, Date) -> Void = { rescheduler.move($0, to: $1, dates: dates) }
        switch navigator.mode {
        case .month:
            CalendarMonthGrid(
                focus: navigator.focus, byDay: byDay, postedByDay: posted, dates: dates,
                onOpen: open, onDrop: drop,
                onShowMore: { navigator.showWeek(of: $0) }
            )
        case .week:
            CalendarWeekGrid(
                focus: navigator.focus, byDay: byDay, postedByDay: posted, dates: dates,
                onOpen: open, onDrop: drop
            )
        }
    }
}
