import SwiftUI

/// The outline, corners and rotate grip of the selected text layer, drawn over
/// the stage so a card that runs past the frame keeps its handles. See
/// `OverlaySelectionChrome` for why they are not inside the stage.
struct TextLayerSelectionChrome: View {
    @ObservedObject var session: EditorSession
    let layer: ProjectTextLayer
    let canvasSize: CGSize
    @ObservedObject var drag: CanvasDragState
    /// Typing in the inspector, so the outline fits the text being typed.
    @ObservedObject var typing: TypingPreviewState

    private var displayed: ProjectTextLayer {
        var shown = drag.textDraft(for: layer.id) ?? layer
        if let typed = typing.textLayerText[layer.id] { shown.text = typed }
        return shown
    }

    var body: some View {
        let displayed = displayed
        TextLayerCanvasLabel(layer: displayed, canvasSize: canvasSize)
            .hidden()
            .allowsHitTesting(false)
            .overlay {
                RoundedRectangle(cornerRadius: 9, style: .continuous)
                    .stroke(Color.yapperOrange, style: StrokeStyle(lineWidth: 1.25, dash: [5, 3]))
                    .padding(-4)
                    .allowsHitTesting(false)
            }
            .overlay(alignment: .topLeading) { resizeHandle(.topLeading) }
            .overlay(alignment: .topTrailing) { resizeHandle(.topTrailing) }
            .overlay(alignment: .bottomLeading) { resizeHandle(.bottomLeading) }
            .overlay(alignment: .bottomTrailing) { resizeHandle(.bottomTrailing) }
            .overlay(alignment: .top) { TurnRing().offset(y: -TurnHandle.reach) }
            .overlay { turnPad(centre: centreOnStage(of: displayed)) }
            // The card and its handles turn together, so the corner you grab is
            // always the corner you can see.
            .rotationEffect(.degrees(displayed.rotation))
            .position(x: canvasSize.width * layer.x, y: canvasSize.height * layer.y)
            .offset(TextLayerCanvasCommit.dragOffset(for: layer, drag: drag, canvasSize: canvasSize))
    }

    private func centreOnStage(of layer: ProjectTextLayer) -> CGPoint {
        CGPoint(x: canvasSize.width * layer.x, y: canvasSize.height * layer.y)
    }

    private func beginIfNeeded() {
        if drag.textOrigin?.id != layer.id { drag.beginText(layer) }
    }

    private func finish() {
        if let finished = drag.holdText() {
            TextLayerCanvasCommit.commit(finished, session: session, drag: drag)
        }
    }

    /// The pad that turns the card, held still while it is dragged: see
    /// `TurnHandle`. The card is placed from its centre, so that is the point
    /// the angle is measured about.
    private func turnPad(centre: CGPoint) -> some View {
        ZStack(alignment: .top) {
            Color.clear.allowsHitTesting(false)
            TurnPad { start, current, ended in
                beginIfNeeded()
                guard let origin = drag.textOrigin else { return }
                drag.updateText(
                    TextCanvasGeometry.rotated(layer: origin, centre: centre, from: start, to: current)
                )
                if ended { finish() }
            }
            .offset(y: -TurnHandle.reach)
        }
        // Turned back by however far the card has turned since the drag began,
        // so that in the frame's own points it stands still.
        .rotationEffect(.degrees(heldRotation - displayed.rotation))
        .accessibilityLabel("Rotate text")
    }

    /// The angle the card stood at when the gesture in flight began.
    private var heldRotation: Double {
        guard let origin = drag.textOrigin, origin.id == layer.id else { return displayed.rotation }
        return origin.rotation
    }

    private func resizeHandle(_ corner: CanvasResizeCorner) -> some View {
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
                // no more measure against itself than the layer can.
                DragGesture(minimumDistance: 0, coordinateSpace: .named(CanvasCoordinateSpace.stage))
                    .onChanged { value in
                        beginIfNeeded()
                        guard let origin = drag.textOrigin else { return }
                        drag.updateText(
                            TextCanvasGeometry.resized(
                                layer: origin,
                                translation: value.translation,
                                corner: corner,
                                canvasSize: canvasSize
                            )
                        )
                    }
                    .onEnded { _ in finish() }
            )
            .accessibilityLabel("Resize text from \(corner.accessibilityName)")
    }
}
