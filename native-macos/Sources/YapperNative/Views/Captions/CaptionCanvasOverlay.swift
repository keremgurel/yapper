@preconcurrency import AppKit
import SwiftUI

/// Draws the caption card under the playhead on the player, and lets it be
/// selected, dragged and resized right there.
struct CaptionCanvasOverlay: View {
    @ObservedObject var session: EditorSession
    @ObservedObject private var captionSelection: CaptionSelectionState
    /// Watches which card is on screen rather than the clock: see
    /// OverlayCanvasLayer for why.
    @ObservedObject var cursor: PlaybackCursor
    /// Owned here rather than in the card so the lines can span the whole
    /// stage instead of being clipped to the card being dragged.
    @StateObject private var guides = CanvasGuidePresenter()

    init(session: EditorSession, cursor: PlaybackCursor) {
        self.session = session
        _captionSelection = ObservedObject(wrappedValue: session.captionSelection)
        self.cursor = cursor
    }

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

    private var style: TextStyle { cue.style }
    /// What the gesture is doing right now wins over what is saved.
    private var draft: CanvasDragState.CaptionDraft? { drag.captionDraft(for: cue.id) }
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
        CaptionCanvasLabel(cue: cue, canvasSize: canvasSize, width: draft?.width)
            .contentShape(Rectangle())
            .onTapGesture { session.selectCaption(cue.id) }
            .contextMenu {
                PropertiesMenuItems(session: session, item: .caption(cue.id))
            }
            .gesture(moveGesture)
            // The outline, width grip and rotate grip are drawn over the stage
            // by CaptionSelectionChrome, so the clip at the frame's edge cannot
            // cut them off.
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
                if let finished = drag.holdCaption() {
                    let commit = session.moveCaption(cue.id, x: finished.x, y: finished.y)
                    Task { _ = await commit.value; drag.releaseCaption(cue.id) }
                }
                onGuidesChanged([])
            }
    }
}
