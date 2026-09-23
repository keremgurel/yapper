import Foundation

/// The brand kit: one read, kept for next time, and every change made
/// through it one at a time (the web panel also runs one change at a time).
@MainActor
final class BrandKitStore: ObservableObject {
    static let shared = BrandKitStore()

    @Published var kit: BrandKit?
    /// The first read failed and there is nothing cached to show.
    @Published private(set) var loadFailed = false
    /// The last change that didn't save, in the creator's words.
    @Published var actionError: String?
    @Published private(set) var busy = false

    func refresh() async {
        do {
            kit = try await StudioJSONClient.get("api/brand", as: BrandKit.self)
            loadFailed = false
        } catch {
            if kit == nil { loadFailed = true }
        }
    }

    /// Runs one change, keeping `busy` and `actionError` honest around it.
    func perform(_ change: @MainActor () async throws -> Void) async {
        guard !busy, kit != nil else { return }
        busy = true
        actionError = nil
        defer { busy = false }
        do {
            try await change()
        } catch {
            actionError = BrandErrorMessage.text(for: error)
        }
    }
}
