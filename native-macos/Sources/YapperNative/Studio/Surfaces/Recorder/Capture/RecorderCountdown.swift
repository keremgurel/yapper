import Foundation

/// The 3, 2, 1 before a take. Cancel stops it without recording.
@MainActor
final class RecorderCountdown: ObservableObject {
    @Published private(set) var count: Int?

    private var task: Task<Void, Never>?

    var active: Bool { count != nil }

    func start(from seconds: Int = 3, then action: @escaping @MainActor () -> Void) {
        cancel()
        count = seconds
        task = Task { [weak self] in
            for remaining in stride(from: seconds, to: 0, by: -1) {
                self?.count = remaining
                try? await Task.sleep(for: .seconds(1))
                if Task.isCancelled { return }
            }
            self?.count = nil
            action()
        }
    }

    func cancel() {
        task?.cancel()
        task = nil
        count = nil
    }
}
