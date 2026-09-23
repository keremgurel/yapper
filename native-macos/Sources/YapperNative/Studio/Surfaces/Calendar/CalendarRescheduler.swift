import Foundation

/// Drag-to-reschedule: shows the new date at once, saves it, and puts the last
/// saved date back if the save fails. Saves for one item run in order, and a
/// late failure never undoes a newer move.
@MainActor
final class CalendarRescheduler: ObservableObject {
    static let shared = CalendarRescheduler(store: .shared)

    /// Items whose last move didn't save, with the date that was wanted.
    @Published private(set) var failedMoves: [String: String] = [:]

    private let store: CalendarStore
    private var states: [String: MoveState] = [:]

    private struct MoveState {
        var saved: String?
        var revision = 0
        var pending = 0
        var tail: Task<Void, Never>?
    }

    init(store: CalendarStore) {
        self.store = store
    }

    func move(_ id: String, to day: Date, dates: CalendarDates) {
        guard let row = store.item(id) else { return }
        let wanted = StudioISODate.string(dates.rescheduled(row.scheduledDate, to: day))
        if let current = row.scheduledDate, StudioISODate.string(current) == wanted { return }
        save(id, wanted: wanted, current: row.scheduledFor)
    }

    func retry(_ id: String) {
        guard let wanted = failedMoves[id] else { return }
        save(id, wanted: wanted, current: store.item(id)?.scheduledFor)
    }

    private func save(_ id: String, wanted: String, current: String?) {
        var state = states[id] ?? MoveState()
        if state.pending == 0 { state.saved = current }
        state.revision += 1
        state.pending += 1
        let revision = state.revision
        let previous = state.tail
        store.show(id, scheduledFor: wanted)
        state.tail = Task { [weak self] in
            await previous?.value
            await self?.run(id, wanted: wanted, revision: revision)
        }
        states[id] = state
    }

    private func run(_ id: String, wanted: String, revision: Int) async {
        let result: Result<String?, Error>
        do {
            let response: CalendarItemResponse = try await StudioJSONClient.patch(
                "api/content/\(id)", body: CalendarReschedulePatch(scheduledFor: wanted)
            )
            result = .success(response.item.scheduledFor)
        } catch {
            result = .failure(error)
        }
        guard var state = states[id] else { return }
        state.pending -= 1
        let latest = state.revision == revision
        switch result {
        case .success(let saved):
            state.saved = saved
            if latest {
                store.show(id, scheduledFor: saved)
                failedMoves[id] = nil
            }
        case .failure:
            if latest {
                store.show(id, scheduledFor: state.saved)
                failedMoves[id] = wanted
            }
        }
        states[id] = state
    }
}
