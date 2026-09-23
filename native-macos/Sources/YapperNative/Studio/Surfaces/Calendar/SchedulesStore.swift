import Foundation

/// Posts queued to send to a platform, shown above the calendar. Re-read on
/// demand and every 30 seconds while the page is open.
@MainActor
final class SchedulesStore: ObservableObject {
    static let shared = SchedulesStore()

    @Published private(set) var response: SchedulesResponse?
    @Published private(set) var refreshFailed = false

    private var revision = 0

    /// Hidden when the server has scheduling off and nothing was ever queued.
    var isHidden: Bool {
        guard let response else { return false }
        return !response.enabled && response.schedules.isEmpty
    }

    /// Active posts first, soonest first; the rest keep the server's order.
    var rows: [ScheduleSummary] {
        let all = response?.schedules ?? []
        let active = all.filter(\.status.isActive).sorted {
            ($0.scheduledDate ?? .distantFuture) < ($1.scheduledDate ?? .distantFuture)
        }
        return active + all.filter { !$0.status.isActive }
    }

    func refresh() async {
        revision += 1
        let current = revision
        do {
            let result: SchedulesResponse = try await StudioJSONClient.get("api/publish/schedules")
            guard current == revision else { return }
            response = result
            refreshFailed = false
        } catch {
            guard current == revision else { return }
            refreshFailed = true
        }
    }

    /// Cancel, move, or retry one post. Throws the creator-facing message.
    func change(_ row: ScheduleSummary, action: ScheduleAction, to date: Date?) async throws {
        let body = ScheduleChangeRequest(
            action: action,
            scheduledFor: action == .cancel ? nil : date.map(StudioISODate.string)
        )
        do {
            let result: ScheduleChangeResponse = try await StudioJSONClient.patch(
                "api/publish/schedules/\(row.id)", body: body
            )
            // A read already in flight must not paint over the saved row.
            revision += 1
            replace(result.schedule)
        } catch {
            throw ScheduleChangeError(message: ScheduleErrorCopy.message(for: error))
        }
    }

    private func replace(_ saved: ScheduleSummary) {
        guard let response else { return }
        self.response = SchedulesResponse(
            enabled: response.enabled,
            schedules: response.schedules.map { $0.id == saved.id ? saved : $0 }
        )
    }
}

struct ScheduleChangeError: LocalizedError {
    let message: String
    var errorDescription: String? { message }
}
