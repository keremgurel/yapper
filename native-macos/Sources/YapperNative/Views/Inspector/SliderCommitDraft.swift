import Foundation

/// When an inspector slider saves, and what it shows until it has.
///
/// A drag saves once, on release. A change with no drag behind it (the arrow
/// keys with Full Keyboard Access, a VoiceOver increment) never sends a
/// release, so it saves once the changes pause. A typed number saves at once.
/// The value stays as the draft until its save has landed, so the handle never
/// jumps back to the old value for the moment the save takes.
@MainActor
final class SliderCommitDraft: ObservableObject {
    @Published private(set) var value: Double?
    private var dragging = false
    private var pause: Task<Void, Never>?
    private let settle: Duration

    init(settle: Duration = .milliseconds(450)) {
        self.settle = settle
    }

    func beginDrag() {
        dragging = true
        pause?.cancel()
    }

    func change(to newValue: Double, commit: @escaping (Double) async -> Void) {
        value = newValue
        guard !dragging else { return }
        pause?.cancel()
        pause = Task { [weak self, settle] in
            try? await Task.sleep(for: settle)
            guard !Task.isCancelled else { return }
            self?.save(newValue, commit: commit)
        }
    }

    func endDrag(commit: @escaping (Double) async -> Void) {
        dragging = false
        guard let released = value else { return }
        save(released, commit: commit)
    }

    func type(_ typed: Double, commit: @escaping (Double) async -> Void) {
        value = typed
        save(typed, commit: commit)
    }

    private func save(_ saved: Double, commit: @escaping (Double) async -> Void) {
        pause?.cancel()
        pause = nil
        Task {
            await commit(saved)
            if value == saved { value = nil }
        }
    }
}
