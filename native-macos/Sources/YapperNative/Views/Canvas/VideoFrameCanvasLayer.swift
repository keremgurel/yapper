import SwiftUI

/// The part of framing that belongs inside the stage: somewhere to push the
/// picture from, and the lines it settles onto.
///
/// Sits under the overlays, the text and the captions, so a click meant for one
/// of those still reaches it and only a click that misses them all lands here.
/// It draws nothing at all until the picture has been picked up.
///
/// The box and the corner handles are not here: they follow the picture, which
/// can be anywhere including outside the frame, and the stage is clipped at its
/// own edge. They are drawn over the stage instead, by
/// `VideoFrameHandleOverlay`.
struct VideoFrameCanvasLayer: View {
    @ObservedObject var session: EditorSession
    @ObservedObject var drag: CanvasDragState
    @StateObject private var guides = CanvasGuidePresenter()

    var body: some View {
        GeometryReader { proxy in
            ZStack {
                if session.isVideoFrameSelected {
                    panArea(canvasSize: proxy.size)
                }
                CanvasGuideOverlay(guides: guides.guides, canvasSize: proxy.size)
            }
        }
        .clipped()
    }

    /// Anywhere on the frame that is not an overlay is somewhere the picture
    /// can be pushed from, whether or not the picture itself reaches there.
    /// Grabbing footage that has been zoomed down to a corner would be fiddly
    /// otherwise.
    private func panArea(canvasSize: CGSize) -> some View {
        Color.clear
            .contentShape(Rectangle())
            .cursor(.openHand)
            .gesture(
                VideoFramingGesture(
                    session: session,
                    drag: drag,
                    stageSize: canvasSize,
                    onGuidesChanged: { guides.show($0) }
                ).pan
            )
    }
}
