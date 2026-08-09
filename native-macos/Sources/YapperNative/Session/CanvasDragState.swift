import CoreGraphics
import Foundation

/// Where something on the player canvas has been dragged to, before the drag
/// ends and the project hears about it.
///
/// This used to live in `@State` on the item being dragged, which turned out to
/// be a bad place for it: something re-creates those views mid-gesture, the
/// state goes with them, and the item snaps back to its saved position until
/// the next mouse event moves it again. Recorded at 120 frames a second, an
/// overlay was alternating between the two positions every 25 to 40 milliseconds
/// — the flicker that looked like a duplicate.
///
/// Holding the in-flight drag out here means it no longer matters how often the
/// views are rebuilt: the drag is not theirs to lose. It is the same shape as
/// `TimelineDragState`, which is why timeline drags never had this problem.
@MainActor
final class CanvasDragState: ObservableObject {
    /// The overlay being dragged, as it currently stands.
    @Published private(set) var overlay: ProjectOverlay?
    /// Where the overlay was when the drag began, so every step measures from
    /// the same place rather than compounding.
    private(set) var overlayOrigin: ProjectOverlay?

    @Published private(set) var textLayer: ProjectTextLayer?
    private(set) var textOrigin: ProjectTextLayer?

    /// A caption card is dragged by position and width alone.
    @Published private(set) var caption: CaptionDraft?
    private(set) var captionOrigin: CaptionDraft?

    struct CaptionDraft: Equatable, Sendable {
        var id: UUID
        var x: Double
        var y: Double
        var width: Double
    }

    /// How the main track's picture is being framed right now.
    ///
    /// Unlike the others this one is not just a draft of a saved value: the
    /// composition on screen is still showing an older framing, because
    /// rebuilding it takes long enough that doing it per mouse event would
    /// stutter. The player is transformed by the difference in the meantime,
    /// which `RenderedFramingStore` works out, because that difference outlives
    /// the gesture: the wait for the rebuild starts when the drag ends.
    @Published private(set) var framing: VideoFraming?
    private(set) var framingOrigin: VideoFraming?
    /// Which clip is being framed, so the commit lands on the clip the gesture
    /// started over rather than whichever one the playhead has reached.
    private(set) var framingClipID: UUID?
    /// Where on the stage the gesture currently being served pressed down.
    ///
    /// The one thing that tells a step of the same gesture apart from the first
    /// step of a replacement for it, which matters because a framing gesture
    /// gets replaced: the handle travels out from under the pointer as the
    /// picture grows, and SwiftUI drops the drag and starts another one. Every
    /// step measures from `framingOrigin`, so a replacement starting its
    /// translation from zero threw the picture back to where the whole thing
    /// began. That is the resize that popped back and grew again, over and
    /// over. See `VideoFramingGesture`.
    private(set) var framingStart: CGPoint?

    // MARK: - Overlay

    func beginOverlay(_ overlay: ProjectOverlay) {
        overlayOrigin = overlay
        self.overlay = overlay
    }

    func updateOverlay(_ overlay: ProjectOverlay) {
        guard overlay != self.overlay else { return }
        self.overlay = overlay
    }

    /// The draft for `id`, or nothing when another item is being dragged.
    func overlayDraft(for id: UUID) -> ProjectOverlay? {
        overlay?.id == id ? overlay : nil
    }

    func endOverlay() -> ProjectOverlay? {
        defer {
            overlay = nil
            overlayOrigin = nil
        }
        return overlay
    }

    // MARK: - Video framing

    /// Starts a framing gesture, or re-bases the one in flight onto the drag
    /// that has taken it over. Both are the same act: from here on, steps are
    /// measured from `framing` and from `start`.
    func beginFraming(_ framing: VideoFraming, clipID: UUID, from start: CGPoint) {
        framingOrigin = framing
        framingClipID = clipID
        framingStart = start
        self.framing = framing
    }

    func updateFraming(_ framing: VideoFraming) {
        guard framing != self.framing else { return }
        self.framing = framing
    }

    func endFraming() -> (framing: VideoFraming, clipID: UUID)? {
        defer {
            framing = nil
            framingOrigin = nil
            framingClipID = nil
            framingStart = nil
        }
        guard let framing, let clipID = framingClipID else { return nil }
        return (framing, clipID)
    }

    // MARK: - Text layer

    func beginText(_ layer: ProjectTextLayer) {
        textOrigin = layer
        textLayer = layer
    }

    func updateText(_ layer: ProjectTextLayer) {
        guard layer != textLayer else { return }
        textLayer = layer
    }

    func textDraft(for id: UUID) -> ProjectTextLayer? {
        textLayer?.id == id ? textLayer : nil
    }

    func endText() -> ProjectTextLayer? {
        defer {
            textLayer = nil
            textOrigin = nil
        }
        return textLayer
    }

    // MARK: - Caption

    func beginCaption(_ draft: CaptionDraft) {
        captionOrigin = draft
        caption = draft
    }

    func updateCaption(_ draft: CaptionDraft) {
        guard draft != caption else { return }
        caption = draft
    }

    func captionDraft(for id: UUID) -> CaptionDraft? {
        caption?.id == id ? caption : nil
    }

    func endCaption() -> CaptionDraft? {
        defer {
            caption = nil
            captionOrigin = nil
        }
        return caption
    }
}
