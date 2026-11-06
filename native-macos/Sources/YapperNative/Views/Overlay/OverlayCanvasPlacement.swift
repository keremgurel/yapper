import SwiftUI

/// Where an overlay sits on the canvas this frame.
///
/// Shared by the two halves of an overlay on the player: the picture, drawn
/// inside the stage and clipped by it the way the export is, and the selection
/// chrome, drawn over the stage so a corner past the edge of the frame can
/// still be seen and grabbed. Both have to agree on the box to the point, or
/// the handles would drift off the corners they resize.
struct OverlayCanvasPlacement {
    /// The overlay as it looks right now: the drag while one runs, the saved
    /// item otherwise.
    let displayed: ProjectOverlay
    /// Where it is drawn, which follows a resize live.
    let box: CGRect
    /// Where it is placed from, which a move leaves alone: see `dragOffset`.
    let savedBox: CGRect
    private let isDragging: Bool

    @MainActor
    init(session: EditorSession, overlay: ProjectOverlay, drag: CanvasDragState, canvasSize: CGSize) {
        let draft = drag.overlayDraft(for: overlay.id)
        let displayed = draft ?? overlay
        self.displayed = displayed
        isDragging = draft != nil
        box = OverlayFrame.fitted(
            OverlayFrame.box(displayed, in: canvasSize),
            mediaAspect: session.aspects(for: displayed).media
        )
        savedBox = OverlayFrame.fitted(
            OverlayFrame.box(overlay, in: canvasSize),
            mediaAspect: session.aspects(for: overlay).media
        )
    }

    /// The saved box places the overlay; the drag is carried as a transform on
    /// top, so a move is a render-time offset rather than a layout pass. See
    /// CaptionCanvasOverlay for why.
    var dragOffset: CGSize {
        guard isDragging else { return .zero }
        return CGSize(width: box.midX - savedBox.midX, height: box.midY - savedBox.midY)
    }
}

/// The end of any overlay gesture, from the body or from a handle: the project
/// hears about the drag once, here, and the guides go away.
@MainActor
enum OverlayCanvasCommit {
    static func finish(session: EditorSession, drag: CanvasDragState) {
        if let finished = drag.endOverlay() { session.commitOverlayEdit(finished) }
    }
}
