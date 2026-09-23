import Foundation

/// The creator's storage numbers: one read, kept so returning to the tab
/// shows the last numbers at once while a fresh read runs.
@MainActor
final class StorageStore: ObservableObject {
    static let shared = StorageStore()

    @Published private(set) var usage: StorageUsage?
    @Published private(set) var error: String?

    var loading: Bool { usage == nil && error == nil }

    func refresh() async {
        do {
            usage = try await StudioJSONClient.get("api/storage")
            error = nil
        } catch {
            if usage == nil { self.error = error.localizedDescription }
        }
    }
}
