import Foundation

/// Publishes what the playhead is sitting on, as opposed to where it is.
///
/// The transcript highlights the word being spoken. Reading the raw time for
/// that made it re-lay-out every word token thirty times a second; the answer
/// only actually changes when the playhead crosses into the next word, a few
/// times a second at most. This publishes that crossing and nothing else.
@MainActor
final class PlaybackCursor: ObservableObject {
    @Published private(set) var transcriptWordID: UUID?

    /// What the canvas has on screen right now.
    ///
    /// The canvas layers used to watch the clock, so all three of them rebuilt
    /// thirty times a second while the video played, whatever was or was not on
    /// screen. What they actually need is far rarer: the moment an item comes or
    /// goes. That is what this publishes.
    @Published private(set) var canvasItems = CanvasItems()

    struct CanvasItems: Equatable, Sendable {
        var overlayIDs: [UUID] = []
        var textLayerIDs: [UUID] = []
        var captionID: UUID?
    }

    func setCanvasItems(_ items: CanvasItems) {
        guard items != canvasItems else { return }
        canvasItems = items
    }

    func setTranscriptWordID(_ id: UUID?) {
        guard id != transcriptWordID else { return }
        transcriptWordID = id
    }
}
