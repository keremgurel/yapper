@preconcurrency import AppKit
import SwiftUI

/// The outline, width grip and rotate grip of the selected caption card, drawn
/// over the stage so they are never cut off by the frame's edge. See
/// `OverlaySelectionChrome` for why they are not inside the stage.
struct CaptionSelectionChrome: View {
    @ObservedObject var session: EditorSession
    let cue: ProjectCaptionCue
    let canvasSize: CGSize
    /// Held on the session: see CanvasDragState.
    @ObservedObject var drag: CanvasDragState

    private var style: TextStyle { cue.style }
    private var draft: CanvasDragState.CaptionDraft? { drag.captionDraft(for: cue.id) }
    private var rotation: Double { draft?.rotation ?? style.rotation }

    private var anchor: CGPoint {
        CGPoint(x: canvasSize.width * style.x, y: canvasSize.height * style.y)
    }

    private var dragOffset: CGSize {
        guard let draft else { return .zero }
        return CGSize(
            width: (draft.x - style.x) * canvasSize.width,
            height: (draft.y - style.y) * canvasSize.height
        )
    }

    var body: some View {
        CaptionCanvasLabel(cue: cue, canvasSize: canvasSize, width: draft?.width)
            .hidden()
            .allowsHitTesting(false)
            .overlay {
                RoundedRectangle(cornerRadius: 9, style: .continuous)
                    .stroke(Color.yapperOrange, style: StrokeStyle(lineWidth: 1.25, dash: [5, 3]))
                    .padding(-4)
                    .allowsHitTesting(false)
            }
            .overlay(alignment: .trailing) { widthHandle }
            .overlay(alignment: .top) { TurnRing().offset(y: -TurnHandle.reach) }
            .overlay { turnPad }
            // The card and its grips turn together, so the grip you reach for
            // is always on the edge you can see.
            .rotationEffect(.degrees(rotation))
            .position(anchor)
            .offset(dragOffset)
            .animation(.easeOut(duration: 0.08), value: cue.id)
    }

    private var isSnapBypassed: Bool { NSEvent.modifierFlags.contains(.option) }

    private func beginDraftIfNeeded() {
        guard drag.captionOrigin?.id != cue.id else { return }
        drag.beginCaption(
            CanvasDragState.CaptionDraft(
                id: cue.id,
                x: style.x,
                y: style.y,
                width: style.width,
                rotation: style.rotation
            )
        )
    }

    /// The pad that turns the card, held still while it is dragged: see
    /// `TurnHandle`. The card is placed from its centre, so that is the point
    /// the angle is measured about.
    private var turnPad: some View {
        ZStack(alignment: .top) {
            Color.clear.allowsHitTesting(false)
            TurnPad { start, current, ended in
                beginDraftIfNeeded()
                guard let origin = drag.captionOrigin else { return }
                drag.updateCaption(turned(origin, from: start, to: current))
                if ended, let finished = drag.holdCaption() {
                    let commit = session.rotateCaption(cue.id, rotation: finished.rotation)
                    Task { _ = await commit.value; drag.releaseCaption(cue.id) }
                }
            }
            .offset(y: -TurnHandle.reach)
        }
        // Turned back by however far the card has turned since the drag began,
        // so that in the frame's own points it stands still.
        .rotationEffect(.degrees(heldRotation - rotation))
        .accessibilityLabel("Rotate caption")
    }

    /// The angle the card stood at when the gesture in flight began.
    private var heldRotation: Double {
        guard let origin = drag.captionOrigin, origin.id == cue.id else { return rotation }
        return origin.rotation
    }

    private func turned(
        _ origin: CanvasDragState.CaptionDraft,
        from start: CGPoint,
        to current: CGPoint
    ) -> CanvasDragState.CaptionDraft {
        let centre = CGPoint(x: canvasSize.width * origin.x, y: canvasSize.height * origin.y)
        let swept = VideoFramingGeometry.angle(at: current, about: centre)
            - VideoFramingGeometry.angle(at: start, about: centre)
        var rotation = VideoFraming.wrap(origin.rotation + swept)
        if !isSnapBypassed {
            let quarter = (rotation / 90).rounded() * 90
            if abs(rotation - quarter) <= VideoFramingGeometry.rotationSnapDegrees {
                rotation = quarter
            }
        }
        var turned = origin
        turned.rotation = rotation
        return turned
    }

    /// Widening the card rewraps the text; the font size stays where it was set.
    private var widthHandle: some View {
        RoundedRectangle(cornerRadius: 2, style: .continuous)
            .fill(Color.white)
            .overlay {
                RoundedRectangle(cornerRadius: 2, style: .continuous)
                    .stroke(Color.yapperOrange, lineWidth: 1.5)
            }
            .frame(width: 6, height: 20)
            .offset(x: 7)
            .contentShape(Rectangle().inset(by: -7))
            .highPriorityGesture(
                // The card is centred, so widening it carries this handle out
                // to the right at the same time. Measuring against the handle
                // would mean measuring against the thing being changed.
                DragGesture(minimumDistance: 0, coordinateSpace: .named(CanvasCoordinateSpace.stage))
                    .onChanged { value in
                        beginDraftIfNeeded()
                        guard let origin = drag.captionOrigin, canvasSize.width > 0 else { return }
                        // The card is centred, so it grows from both edges at
                        // once and the pointer stays on the handle.
                        drag.updateCaption(
                            CanvasDragState.CaptionDraft(
                                id: cue.id,
                                x: origin.x,
                                y: origin.y,
                                width: origin.width + 2 * value.translation.width / canvasSize.width,
                                rotation: origin.rotation
                            )
                        )
                    }
                    .onEnded { _ in
                        if let finished = drag.holdCaption() {
                            let commit = session.resizeCaption(cue.id, width: finished.width)
                            Task { _ = await commit.value; drag.releaseCaption(cue.id) }
                        }
                    }
            )
    }
}
