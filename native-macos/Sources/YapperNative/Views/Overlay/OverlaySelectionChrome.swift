@preconcurrency import AppKit
import SwiftUI

/// The corners and rotate grip of the selected overlay.
///
/// Drawn over the stage, not inside it. The stage is clipped at the frame's
/// edge the way the export is, and a full-frame overlay has its corners exactly
/// on that edge, so half of every handle was cut off; an overlay larger than the
/// frame, or moved partly off it, lost its handles altogether. Out here they
/// hang over the workspace around the canvas and stay reachable.
///
/// Only the handles take clicks. Moving the overlay is still the picture's job,
/// inside the stage, where it stacks under the text and the captions.
struct OverlaySelectionChrome: View {
    @ObservedObject var session: EditorSession
    let overlay: ProjectOverlay
    let canvasSize: CGSize
    @ObservedObject var drag: CanvasDragState

    var body: some View {
        let placement = OverlayCanvasPlacement(session: session, overlay: overlay, drag: drag, canvasSize: canvasSize)
        let frame = placement.box
        let displayed = placement.displayed
        Color.clear
            .frame(width: max(1, frame.width), height: max(1, frame.height))
            .allowsHitTesting(false)
            .overlay(alignment: .topLeading) { handle(.topLeading) }
            .overlay(alignment: .topTrailing) { handle(.topTrailing) }
            .overlay(alignment: .bottomLeading) { handle(.bottomLeading) }
            .overlay(alignment: .bottomTrailing) { handle(.bottomTrailing) }
            .overlay(alignment: .top) { TurnRing().offset(y: -TurnHandle.reach) }
            .overlay {
                turnPad(centre: CGPoint(x: frame.midX, y: frame.midY), displayed: displayed)
            }
            // The handles turn with the card, so the corner you grab is always
            // the corner you can see.
            .rotationEffect(.degrees(displayed.resolvedRotation))
            .position(x: placement.savedBox.midX, y: placement.savedBox.midY)
            .offset(placement.dragOffset)
    }

    private func handle(_ corner: CanvasResizeCorner) -> some View {
        OverlayResizeHandle(corner: corner) { ended, translation in
            resize(corner: corner, translation: translation, ended: ended)
        }
    }

    /// The handle you can grab, which stands still for as long as it is held.
    ///
    /// Turned back by however far the card has turned since the drag began, so
    /// that in the frame's own points it does not move. A pad that swept round
    /// with the ring left the pointer behind within a few degrees, SwiftUI
    /// cancelled the drag and offered a fresh one, and every restart threw away
    /// the movement it began with.
    private func turnPad(centre: CGPoint, displayed: ProjectOverlay) -> some View {
        ZStack(alignment: .top) {
            Color.clear.allowsHitTesting(false)
            TurnPad { start, current, ended in
                turn(centre: centre, from: start, to: current, ended: ended)
            }
            .offset(y: -TurnHandle.reach)
        }
        .rotationEffect(.degrees(heldRotation(displayed) - displayed.resolvedRotation))
        .accessibilityLabel("Rotate overlay")
    }

    /// The angle the card stood at when the gesture in flight began, which is
    /// where anything that owns a drag has to stay.
    private func heldRotation(_ displayed: ProjectOverlay) -> Double {
        guard let origin = drag.overlayOrigin, origin.id == overlay.id else {
            return displayed.resolvedRotation
        }
        return origin.resolvedRotation
    }

    private func turn(centre: CGPoint, from start: CGPoint, to current: CGPoint, ended: Bool) {
        if drag.overlayOrigin?.id != overlay.id { drag.beginOverlay(overlay) }
        guard let origin = drag.overlayOrigin else { return }
        drag.updateOverlay(
            OverlayCanvasGeometry.rotated(
                overlay: origin,
                centre: centre,
                from: start,
                to: current,
                snapping: !NSEvent.modifierFlags.contains(.option)
            )
        )
        if ended { OverlayCanvasCommit.finish(session: session, drag: drag) }
    }

    /// Every step of a resize measures from where the overlay was when the
    /// handle was grabbed. Measuring from the frame it is being dragged through
    /// would compound each step into the next and run away.
    private func resize(corner: CanvasResizeCorner, translation: CGSize, ended: Bool) {
        if drag.overlayOrigin?.id != overlay.id { drag.beginOverlay(overlay) }
        guard let origin = drag.overlayOrigin else { return }
        let aspects = session.aspects(for: origin)
        drag.updateOverlay(
            OverlayCanvasGeometry.resized(
                overlay: origin,
                translation: translation,
                corner: corner,
                canvasSize: canvasSize,
                mediaAspect: aspects.media,
                frameAspect: aspects.frame
            )
        )
        // Same as the move: the drag draws itself, and the project hears about
        // it once, at the end.
        if ended { OverlayCanvasCommit.finish(session: session, drag: drag) }
    }
}

/// One corner grip. Reports the drag as it happens and once more when it ends,
/// so the caller can redraw cheaply and save once.
private struct OverlayResizeHandle: View {
    let corner: CanvasResizeCorner
    let onDrag: (_ ended: Bool, _ translation: CGSize) -> Void

    var body: some View {
        RoundedRectangle(cornerRadius: 1.5, style: .continuous)
            .fill(Color.white)
            .overlay {
                RoundedRectangle(cornerRadius: 1.5, style: .continuous)
                    .stroke(Color.yapperOrange, lineWidth: 1.5)
            }
            .frame(width: 9, height: 9)
            .offset(x: corner.xOffset, y: corner.yOffset)
            .contentShape(Rectangle().inset(by: -8))
            .cursor(.crosshair)
            .highPriorityGesture(
                // The handle travels with the corner it is resizing, so it can
                // no more measure against itself than the overlay can.
                DragGesture(minimumDistance: 0, coordinateSpace: .named(CanvasCoordinateSpace.stage))
                    .onChanged { onDrag(false, $0.translation) }
                    .onEnded { onDrag(true, $0.translation) }
            )
            .accessibilityLabel("Resize overlay from \(corner.accessibilityName)")
    }
}
