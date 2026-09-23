import Foundation

/// The creator's library rows as the calendar sees them. Kept across visits,
/// so a return to the tab shows the last rows at once while it re-reads.
@MainActor
final class CalendarStore: ObservableObject {
    static let shared = CalendarStore()

    @Published private(set) var items: [CalendarItem]?
    @Published private(set) var loadFailed = false

    func refresh() async {
        do {
            let response: CalendarItemsResponse = try await StudioJSONClient.get("api/content")
            items = response.items
            loadFailed = false
        } catch {
            // Stale rows stay visible; only an empty first load is a failure.
            if items == nil { loadFailed = true }
        }
    }

    /// Shows a date on one row without a round trip.
    func show(_ id: String, scheduledFor: String?) {
        guard let index = items?.firstIndex(where: { $0.id == id }) else { return }
        items?[index].scheduledFor = scheduledFor
    }

    func item(_ id: String) -> CalendarItem? {
        items?.first { $0.id == id }
    }
}
