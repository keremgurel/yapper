import Foundation

/// The framing the composition currently on screen was built with.
///
/// The player shows a composition, and a composition bakes the framing in, so
/// asking for a new framing does not change the picture until the rebuild
/// lands. Knowing what is on screen is what lets the canvas fake the
/// difference in the meantime: see `VideoFramingGeometry.previewTransform`.
///
/// Without this the picture snapped back to where it started the instant a
/// framing gesture let go, sat there for the length of the debounce and the
/// rebuild, and then jumped to the new framing. The value was always right; it
/// arrived a fifth of a second late and went the wrong way first.
///
/// Published on its own rather than on the session, so a rebuild finishing
/// redraws the player and nothing else.
@MainActor
final class RenderedFramingStore: ObservableObject {
    /// The clips as the composition has them, keys and all: a keyed clip is
    /// rendering a different framing every frame, so one value per clip could
    /// not describe what is on screen.
    @Published private(set) var byClip: [UUID: TimelineClip] = [:]

    /// Taken from the project the composition was built from, not from whatever
    /// the project has become since.
    func record(_ clips: [TimelineClip]) {
        let next = Dictionary(
            clips.map { ($0.id, $0) },
            uniquingKeysWith: { first, _ in first }
        )
        guard next != byClip else { return }
        byClip = next
    }

    /// What the composition is rendering for this clip at one moment of its
    /// media. A clip it has never been built with is drawn fitted, which is what
    /// a clip with no framing looks like.
    func framing(for clipID: UUID, atSource time: Double = 0) -> VideoFraming {
        guard let clip = byClip[clipID] else { return .identity }
        return VideoFramingTrack.framing(of: clip, atSource: time)
    }
}
