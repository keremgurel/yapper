import Foundation

/// What the creator's 1-Click Edits have saved them, from
/// `GET /api/billing/time-saved`. Shared with the web's Home card.
struct HomeTimeSaved: Decodable, Equatable {
    let edits: Int
    let footageSeconds: Double
    let cutCount: Int
    let cutSeconds: Double
    let savedSeconds: Double
    /// When the first counted edit ran, or nil before any.
    let since: String?
}

/// Keeps the last read, so Home paints the card at once on a return visit.
@MainActor
final class HomeTimeSavedStore: ObservableObject {
    static let shared = HomeTimeSavedStore()

    /// Nil until the first read answers.
    @Published private(set) var saved: HomeTimeSaved?
    /// The last read failed and there is nothing to show.
    @Published private(set) var failed = false

    func refresh() async {
        do {
            saved = try await StudioJSONClient.get("api/billing/time-saved")
            failed = false
        } catch {
            failed = saved == nil
        }
    }
}
