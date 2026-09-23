import Foundation

/// One row's status change: shown at once, saved behind, put back and
/// offered for retry if the save fails.
@MainActor
final class IdeaStatusChanges: ObservableObject {
    static let shared = IdeaStatusChanges()

    /// Rows whose last change could not be saved, with the status wanted.
    @Published private(set) var failures: [String: IdeaStatus] = [:]

    private let store = IdeasStore.shared
    private var generation: [String: Int] = [:]

    func change(_ id: String, to status: IdeaStatus) {
        guard let row = store.item(id), row.status != status.rawValue else { return }
        let previous = row.status
        let scheduledFor = row.scheduledFor
        let ticket = (generation[id] ?? 0) + 1
        generation[id] = ticket
        store.update(id) { $0.status = status.rawValue }

        Task {
            do {
                let saved: IdeaItemResponse = try await StudioJSONClient.patch(
                    "api/content/\(id)", body: StatusPatch(status: status.rawValue, scheduledFor: scheduledFor)
                )
                guard generation[id] == ticket else { return }
                store.update(id) {
                    $0.status = saved.item.status
                    $0.scheduledFor = saved.item.scheduledFor
                    $0.updatedAt = saved.item.updatedAt
                }
                failures[id] = nil
            } catch {
                guard generation[id] == ticket else { return }
                store.update(id) { $0.status = previous }
                failures[id] = status
            }
        }
    }

    func retry(_ id: String) {
        guard let status = failures[id] else { return }
        failures[id] = nil
        change(id, to: status)
    }
}
