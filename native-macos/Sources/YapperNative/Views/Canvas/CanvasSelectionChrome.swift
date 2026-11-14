import SwiftUI

/// The handles of whatever is selected on the canvas, drawn over the stage
/// rather than inside it.
///
/// The stage is clipped at the frame's edge, the way the export is. Anything
/// selected keeps its picture in there, clipped, and hangs its outline and grips
/// out here, over the workspace around the canvas, so an item that is full
/// frame, larger than the frame or moved partly off it can still be seen and
/// resized. `VideoFrameHandleOverlay` does the same for the main picture.
///
/// Same size and place as the stage, and it names the stage's coordinate space
/// for itself, so every grip measures its drag in the same points the items do.
struct CanvasSelectionChrome: View {
    @ObservedObject var session: EditorSession
    let stageSize: CGSize

    var body: some View {
        ZStack {
            OverlaySelectionChromeLayer(
                session: session,
                clock: session.playbackClock,
                cursor: session.playbackCursor,
                canvasSize: stageSize
            )
            TextLayerSelectionChromeLayer(session: session, cursor: session.playbackCursor, canvasSize: stageSize)
            CaptionSelectionChromeLayer(session: session, cursor: session.playbackCursor, canvasSize: stageSize)
        }
        .frame(width: stageSize.width, height: stageSize.height)
        .coordinateSpace(name: CanvasCoordinateSpace.stage)
    }
}

/// The selected overlay's grips, when it is on screen. Watches the clock
/// because a keyed overlay moves as the playhead does, and its grips with it.
private struct OverlaySelectionChromeLayer: View {
    @ObservedObject var session: EditorSession
    @ObservedObject var clock: PlaybackClock
    @ObservedObject var cursor: PlaybackCursor
    let canvasSize: CGSize

    var body: some View {
        if let id = session.selectedOverlayID,
           cursor.canvasItems.overlayIDs.contains(id),
           let overlay = session.overlays.first(where: { $0.id == id }) {
            OverlaySelectionChrome(
                session: session,
                overlay: session.displayedOverlay(overlay),
                canvasSize: canvasSize,
                drag: session.canvasDrag
            )
            .id(id)
        }
    }
}

private struct TextLayerSelectionChromeLayer: View {
    @ObservedObject var session: EditorSession
    @ObservedObject var cursor: PlaybackCursor
    let canvasSize: CGSize

    var body: some View {
        if let id = session.selectedTextLayerID,
           cursor.canvasItems.textLayerIDs.contains(id),
           let layer = session.project.textLayers?.first(where: { $0.id == id }) {
            TextLayerSelectionChrome(session: session, layer: layer, canvasSize: canvasSize, drag: session.canvasDrag,
                                     typing: session.typingPreview)
                .id(id)
        }
    }
}

private struct CaptionSelectionChromeLayer: View {
    @ObservedObject var session: EditorSession
    @ObservedObject private var captionSelection: CaptionSelectionState
    @ObservedObject var cursor: PlaybackCursor
    let canvasSize: CGSize

    init(session: EditorSession, cursor: PlaybackCursor, canvasSize: CGSize) {
        self.session = session
        _captionSelection = ObservedObject(wrappedValue: session.captionSelection)
        self.cursor = cursor
        self.canvasSize = canvasSize
    }

    var body: some View {
        if let id = cursor.canvasItems.captionID,
           session.isCaptionSelected(id),
           let cue = session.captionCue(id) {
            CaptionSelectionChrome(session: session, cue: cue, canvasSize: canvasSize, drag: session.canvasDrag,
                                   typing: session.typingPreview)
                .id(id)
        }
    }
}
