import Foundation

/// Where an autosave stands, for the Saved and Saving note.
enum BrainSaveState: Equatable, Sendable {
    case idle, saving, saved, error

    var label: String? {
        switch self {
        case .idle: nil
        case .saving: "Saving…"
        case .saved: "Saved"
        case .error: "Save failed. Edits retry on your next change."
        }
    }
}

/// Debounces edits, merges them per record, writes one record at a time, and
/// keeps whatever failed so the next change retries it.
///
/// Records are keyed by id so typing in one block never waits on a save in
/// another, and two edits to the same block collapse into one PATCH.
@MainActor
final class BrainAutosaver {
    typealias Write = @MainActor (String, BrainPatch) async throws -> Void

    var onState: (BrainSaveState) -> Void = { _ in }
    private(set) var state: BrainSaveState = .idle {
        didSet { if state != oldValue { onState(state) } }
    }

    private var pending: [String: BrainPatch] = [:]
    private var pendingOrder: [String] = []
    private var timer: Task<Void, Never>?
    private var chain: Task<Void, Error>?
    private let delay = Duration.milliseconds(800)
    /// Sends one record's merged patch. Set by the owning store.
    var write: Write = { _, _ in }

    var hasPending: Bool { !pending.isEmpty }

    func queue(_ id: String, _ patch: BrainPatch) {
        merge(id, patch)
        timer?.cancel()
        timer = Task { [weak self, delay] in
            try? await Task.sleep(for: delay)
            guard !Task.isCancelled else { return }
            try? await self?.flush()
        }
    }

    /// Sends everything queued now, after any write already in flight.
    func flush() async throws {
        timer?.cancel()
        timer = nil
        let previous = chain
        let run = Task { @MainActor [weak self] in
            _ = await previous?.result
            try await self?.drain()
        }
        chain = run
        try await run.value
    }

    /// Drops anything queued for a record that is going away.
    func discard(_ id: String) {
        pending[id] = nil
        pendingOrder.removeAll { $0 == id }
    }

    private func drain() async throws {
        guard !pending.isEmpty else { return }
        let ids = pendingOrder
        let batch = pending
        pending = [:]
        pendingOrder = []
        state = .saving
        for (offset, id) in ids.enumerated() {
            guard let patch = batch[id] else { continue }
            do {
                try await write(id, patch)
            } catch {
                // Keep the failed record and everything after it, under any
                // edit typed while this write was in flight.
                let restored = ids[offset...].filter { batch[$0] != nil }
                for rest in restored {
                    pending[rest] = batch[rest]!.overlaid(with: pending[rest] ?? [:])
                }
                pendingOrder = restored + pendingOrder.filter { !restored.contains($0) }
                state = .error
                throw error
            }
        }
        state = pending.isEmpty ? .saved : .saving
    }

    private func merge(_ id: String, _ patch: BrainPatch) {
        pending[id] = (pending[id] ?? [:]).overlaid(with: patch)
        if !pendingOrder.contains(id) { pendingOrder.append(id) }
    }
}
