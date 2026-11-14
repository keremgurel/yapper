import Foundation

/// Runs edits one at a time per key, the last request winning.
///
/// Each edit is an app action, and an action that starts while the one
/// before it is still landing is refused because the project changed under
/// it. Clicking through backdrop swatches, or dragging in a colour picker,
/// sends a burst of edits: without this every other one was dropped and the
/// control ended on a value nobody chose last.
@MainActor
final class LatestActionQueue {
    static let shared = LatestActionQueue()

    private var pending: [String: () async -> Void] = [:]
    private var running: Set<String> = []

    func request(_ key: String, _ edit: @escaping () async -> Void) {
        pending[key] = edit
        guard !running.contains(key) else { return }
        running.insert(key)
        Task {
            while let next = pending.removeValue(forKey: key) {
                await next()
            }
            running.remove(key)
        }
    }
}
