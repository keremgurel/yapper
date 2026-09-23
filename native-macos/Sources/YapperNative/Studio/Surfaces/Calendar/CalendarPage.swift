import AppKit
import SwiftUI

/// Calendar: queued posts from Poster, then the planning calendar of library
/// items by their dates. Both re-read when the window comes back to the front.
struct CalendarPage: View {
    @ObservedObject var calendar: CalendarStore = .shared
    @ObservedObject var schedules: SchedulesStore = .shared

    var body: some View {
        NativePage {
            NativePageHeader(
                title: "Calendar",
                description: "Plan your content dates and see what's coming next."
            )
            ScheduledPublishingSection(store: schedules)
            ContentCalendarView(store: calendar)
        }
        .task { await calendar.refresh() }
        .task { await pollSchedules() }
        .onReceive(NotificationCenter.default.publisher(for: NSWindow.didBecomeKeyNotification)) { _ in
            Task {
                await calendar.refresh()
                await schedules.refresh()
            }
        }
    }

    /// The web re-reads the queue every 30 seconds while the page is visible.
    private func pollSchedules() async {
        while !Task.isCancelled {
            await schedules.refresh()
            try? await Task.sleep(for: .seconds(30))
        }
    }
}
