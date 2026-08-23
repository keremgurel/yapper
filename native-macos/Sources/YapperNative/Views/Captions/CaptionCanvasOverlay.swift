@preconcurrency import AppKit
import SwiftUI

/// Draws the caption card under the playhead on the player, and lets it be
/// selected, dragged and resized right there.
struct CaptionCanvasOverlay: View {
    @ObservedObject var session: EditorSession
    /// Watches which card is on screen rather than the clock: see
    /// OverlayCanvasLayer for why.
    @ObservedObject var cursor: PlaybackCursor
    /// Owned here rather than in the card so the lines can span the whole
    /// stage instead of being clipped to the card being dragged.
    @StateObject private var guides = CanvasGuidePresenter()

    var body: some View {
        GeometryReader { proxy in
            ZStack {
                if let id = cursor.canvasItems.captionID, let cue = session.captionCue(id) {
                    CaptionCanvasCard(
                        session: session,
                        cue: cue,
                        canvasSize: proxy.size,
                        isSelected: session.isCaptionSelected(cue.id),
                        onGuidesChanged: { guides.show($0) },
                        drag: session.canvasDrag
                    )
                    // One card's drag state must never carry over to the next
                    // card that scrolls under the playhead.
                    .id(cue.id)
                }
                CanvasGuideOverlay(guides: guides.guides, canvasSize: proxy.size)
            }
        }
        .clipped()
    }
}

/// Holding Option drops a caption exactly where the pointer is, matching the
/// bypass the timeline already uses for its own snapping.
private var isCaptionSnapBypassed: Bool {
    NSEvent.modifierFlags.contains(.option)
}

private struct CaptionCanvasCard: View {
    @ObservedObject var session: EditorSession
    let cue: ProjectCaptionCue
    let canvasSize: CGSize
    let isSelected: Bool
    let onGuidesChanged: ([CanvasGuide]) -> Void
    /// Held on the session: see CanvasDragState.
    @ObservedObject var drag: CanvasDragState
    @State private var resizeOrigin: Double?

    private var style: TextStyle { cue.style }
    private var fontSize: CGFloat { max(9, canvasSize.height * style.fontScale) }
    /// What the gesture is doing right now wins over what is saved.
    private var draft: CanvasDragState.CaptionDraft? { drag.captionDraft(for: cue.id) }
    private var boxWidth: CGFloat { max(40, canvasSize.width * (draft?.width ?? style.width)) }
    /// The angle on screen right now: the drag while one runs, the saved style
    /// otherwise.
    private var rotation: Double { draft?.rotation ?? style.rotation }

    /// Where the card is placed: always the saved position, never the drag.
    ///
    /// A drag moves it with `offset` instead, which is a render-time transform.
    /// Changing `position` re-runs layout, and this card's layout means fitting
    /// seventeen copies of the text, which is enough work that most pointer
    /// moves were coalesced away and the card advanced in hops.
    private var anchor: CGPoint {
        CGPoint(x: canvasSize.width * style.x, y: canvasSize.height * style.y)
    }

    /// How far the drag has carried it from that anchor.
    private var dragOffset: CGSize {
        guard let draft else { return .zero }
        return CGSize(
            width: (draft.x - style.x) * canvasSize.width,
            height: (draft.y - style.y) * canvasSize.height
        )
    }

    var body: some View {
        AppearanceText(
            text: cue.text,
            appearance: style.appearance,
            fontSize: fontSize
        )
            .frame(maxWidth: boxWidth)
            // The body takes its own clicks and drags before any decoration
            // goes on top. A hit shape applied after the corner handles cut
            // them off: they hang outside the box on purpose, so the shape
            // clipped exactly the part you reach for, and resizing stopped
            // working on every item at once.
            .contentShape(Rectangle())
            .onTapGesture { session.selectCaption(cue.id) }
            .contextMenu {
                PropertiesMenuItems(session: session, item: .caption(cue.id))
            }
            .gesture(moveGesture)
            .overlay {
                if isSelected {
                    RoundedRectangle(cornerRadius: 9, style: .continuous)
                        .stroke(Color.yapperOrange, style: StrokeStyle(lineWidth: 1.25, dash: [5, 3]))
                        .padding(-4)
                }
            }
            .overlay(alignment: .trailing) {
                if isSelected { widthHandle }
            }
            .overlay(alignment: .top) {
                if isSelected { TurnRing().offset(y: -TurnHandle.reach) }
            }
            .overlay {
                if isSelected { turnPad }
            }
            // The card and its handles turn together, so the grip you reach for
            // is always on the edge you can see.
            .rotationEffect(.degrees(rotation))
            .position(anchor)
            .offset(dragOffset)
            .animation(.easeOut(duration: 0.08), value: cue.id)
    }

    private var moveGesture: some Gesture {
        // Measured against the stage, never against the card: the card is
        // moving with the drag. See CanvasCoordinateSpace.
        DragGesture(minimumDistance: 1, coordinateSpace: .named(CanvasCoordinateSpace.stage))
            .onChanged { value in
                if drag.captionOrigin?.id != cue.id {
                    drag.beginCaption(
                        CanvasDragState.CaptionDraft(
                            id: cue.id,
                            x: style.x,
                            y: style.y,
                            width: style.width,
                            rotation: style.rotation
                        )
                    )
                    if !isSelected { session.selectCaption(cue.id) }
                }
                guard
                    let origin = drag.captionOrigin,
                    canvasSize.width > 0,
                    canvasSize.height > 0
                else { return }
                let snapped = CaptionSnapEngine.snap(
                    x: origin.x + value.translation.width / canvasSize.width,
                    y: origin.y + value.translation.height / canvasSize.height,
                    canvasSize: canvasSize,
                    enabled: !isCaptionSnapBypassed
                )
                onGuidesChanged(snapped.guides)
                drag.updateCaption(
                    CanvasDragState.CaptionDraft(
                        id: cue.id,
                        x: snapped.x,
                        y: snapped.y,
                        width: origin.width,
                        rotation: origin.rotation
                    )
                )
            }
            .onEnded { _ in
                if let finished = drag.endCaption() {
                    session.moveCaption(cue.id, x: finished.x, y: finished.y)
                }
                onGuidesChanged([])
            }
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
                if ended, let finished = drag.endCaption() {
                    session.rotateCaption(cue.id, rotation: finished.rotation)
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
        if !isSelected { session.selectCaption(cue.id) }
    }

    private func turned(
        _ origin: CanvasDragState.CaptionDraft,
        from start: CGPoint,
        to current: CGPoint
    ) -> CanvasDragState.CaptionDraft {
        let centre = CGPoint(
            x: canvasSize.width * origin.x,
            y: canvasSize.height * origin.y
        )
        let swept = VideoFramingGeometry.angle(at: current, about: centre)
            - VideoFramingGeometry.angle(at: start, about: centre)
        var rotation = VideoFraming.wrap(origin.rotation + swept)
        if !isCaptionSnapBypassed {
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
                        if drag.captionOrigin?.id != cue.id {
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
                        if let finished = drag.endCaption() {
                            session.resizeCaption(cue.id, width: finished.width)
                        }
                    }
            )
    }
}

