import Foundation

/// Holds the alignment lines currently on the stage, and decides when to let
/// them go.
///
/// Guides are dropped a beat after the snap lets go, not the instant it does.
/// On the edge of the threshold the engine says yes, no, yes, no from one mouse
/// event to the next, and a line that followed it exactly flashed with it.
@MainActor
final class CanvasGuidePresenter: ObservableObject {
    @Published private(set) var guides: [CanvasGuide] = []

    private var hold: Task<Void, Never>?

    func show(_ next: [CanvasGuide]) {
        hold?.cancel()
        hold = nil
        // The same lines arriving again is most of what a drag reports, and
        // republishing them would rebuild every item on the canvas per event.
        guard next != guides else { return }
        guard next.isEmpty else {
            guides = next
            return
        }
        hold = Task { @MainActor [weak self] in
            try? await Task.sleep(for: .milliseconds(140))
            guard !Task.isCancelled else { return }
            self?.guides = []
        }
    }
}
