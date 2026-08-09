import Foundation

/// Publishes the playhead time, and nothing else.
///
/// It is deliberately not a property of `EditorSession`. The time moves thirty
/// times a second, and every published change on the session invalidates every
/// view that observes it, so a playing timeline was rebuilding the whole editor
/// on every frame. Views that need the moving time observe this object instead,
/// which keeps the redraw down to the playhead and the clock readout.
@MainActor
final class PlaybackClock: ObservableObject {
    @Published private(set) var currentTime = 0.0

    func set(_ time: Double) {
        let safe = time.isFinite ? max(0, time) : 0
        guard abs(safe - currentTime) > 0.000_1 else { return }
        currentTime = safe
    }
}
