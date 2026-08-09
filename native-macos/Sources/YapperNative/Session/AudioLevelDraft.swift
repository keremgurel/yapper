import Foundation

/// Where a fader is right now, before the project hears about it.
///
/// The same trick the canvas drags use, for the same reason: writing to the
/// project publishes it, and publishing rebuilds the editor. A fader dragged
/// across its range does that sixty times a second, so what the slider and the
/// waveform read while a drag is running lives here, and the project is told
/// once, when the drag lets go.
///
/// Published on its own, so pulling a fader redraws the fader and the waveform
/// it belongs to and nothing else.
@MainActor
final class AudioLevelDraft: ObservableObject {
    /// The fader being dragged, and where it has got to. One at a time: nobody
    /// has two hands on two faders.
    @Published private(set) var pending: (id: UUID, volume: Double)?

    /// The main track's own fader, which belongs to no layer.
    @Published private(set) var mainTrack: Double?

    func set(_ volume: Double, for id: UUID) {
        pending = (id, AudioLevel.clamped(volume))
    }

    func volume(for id: UUID) -> Double? {
        pending?.id == id ? pending?.volume : nil
    }

    func setMainTrack(_ volume: Double) {
        mainTrack = AudioLevel.clamped(volume)
    }

    /// Hands back where the fader ended up and forgets it, for the commit.
    func endLayer() -> (id: UUID, volume: Double)? {
        defer { pending = nil }
        return pending
    }

    func endMainTrack() -> Double? {
        defer { mainTrack = nil }
        return mainTrack
    }
}
