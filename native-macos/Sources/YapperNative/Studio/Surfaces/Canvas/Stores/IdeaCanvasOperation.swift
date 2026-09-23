import Foundation

/// One page-level operation at a time (leave, record, delete), with the
/// sentence to show when it fails.
@MainActor
final class IdeaCanvasOperation: ObservableObject {
    @Published private(set) var busy = false
    @Published var error: String?

    func run(failure: String, _ work: @escaping @MainActor () async throws -> Void) {
        guard !busy else { return }
        busy = true
        error = nil
        Task {
            defer { busy = false }
            do { try await work() } catch { self.error = failure }
        }
    }
}
