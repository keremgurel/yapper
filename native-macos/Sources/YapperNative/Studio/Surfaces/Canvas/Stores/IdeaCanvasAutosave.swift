import Foundation

enum IdeaCanvasSaveState: Equatable { case idle, saving, saved, error }

/// Debounced, serialized autosave for one item, like the web's `useAutosave`:
/// edits merge into one pending patch, a write goes out 600 ms after the last
/// edit, writes never overlap, and a failed write keeps its changes for the
/// next attempt.
@MainActor
final class IdeaCanvasAutosave: ObservableObject {
    @Published private(set) var state: IdeaCanvasSaveState = .idle

    private let save: @MainActor (IdeaCanvasPatch) async throws -> Void
    private let delay: Duration
    private var pending = IdeaCanvasPatch()
    private var debounce: Task<Void, Never>?
    private var tail: Task<Void, Never>?

    init(delay: Duration = .milliseconds(600), save: @escaping @MainActor (IdeaCanvasPatch) async throws -> Void) {
        self.delay = delay
        self.save = save
    }

    var hasUnsaved: Bool { !pending.isEmpty }

    func queue(_ patch: IdeaCanvasPatch) {
        pending = pending.merged(with: patch)
        debounce?.cancel()
        debounce = Task { [weak self, delay] in
            try? await Task.sleep(for: delay)
            guard !Task.isCancelled else { return }
            try? await self?.flush()
        }
    }

    /// Sends whatever is pending now, after any write already in flight.
    /// Throws when the changes could not be saved; they stay pending.
    func flush() async throws {
        debounce?.cancel()
        debounce = nil
        let previous = tail
        let job = Task { @MainActor [weak self] () -> Error? in
            await previous?.value
            return await self?.sendPending()
        }
        tail = Task { _ = await job.value }
        if let error = await job.value { throw error }
    }

    private func sendPending() async -> Error? {
        guard !pending.isEmpty else { return nil }
        let batch = pending
        pending = IdeaCanvasPatch()
        state = .saving
        do {
            try await save(batch)
            state = pending.isEmpty ? .saved : .saving
            return nil
        } catch {
            pending = batch.merged(with: pending)
            state = .error
            return error
        }
    }
}
