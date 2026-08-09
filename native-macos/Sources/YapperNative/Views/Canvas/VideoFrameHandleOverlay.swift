import SwiftUI

/// The framing box and its four corners, drawn around the picture wherever the
/// picture has got to.
///
/// Over the stage rather than inside it, and deliberately: the box follows the
/// footage, the footage is routinely zoomed past the frame, and the stage is
/// clipped at its own edge, so corners drawn inside it were unreachable exactly
/// when they were needed. Out here they hang over the workspace instead, and
/// pulling the preview back with `PreviewZoom` makes room for them.
///
/// Only the four corners take clicks. The box is a line to look at: pushing the
/// picture around is the pan area's job, inside the stage, where it can sit
/// under the overlays and the captions.
struct VideoFrameHandleOverlay: View {
    @ObservedObject var session: EditorSession
    /// Read here so the box keeps up with a gesture in flight.
    @ObservedObject var drag: CanvasDragState
    let stageSize: CGSize

    /// Where the picture is right now, which is where the box is drawn.
    private var liveBox: CGRect { session.framingBox(in: stageSize) }

    /// Where the picture was when the gesture in flight started, which is where
    /// the thing you are holding stays.
    ///
    /// A corner moves at about half the speed of the pointer pulling it, so a
    /// handle that carried its own drag walked out from under that drag and
    /// SwiftUI dropped the gesture a few dozen points in. What you saw was a
    /// resize that stopped, popped back and had to be started again. The corner
    /// you can see still follows the picture; the corner that owns the drag
    /// stands still until you let go.
    private var grabBox: CGRect {
        guard let origin = drag.framingOrigin, drag.framingClipID != nil else { return liveBox }
        return VideoFramingGeometry.mediaBox(
            framing: origin,
            sourceAspect: session.framingSourceAspect,
            stageSize: stageSize
        )
    }

    var body: some View {
        let live = liveBox
        let grab = grabBox
        ZStack(alignment: .topLeading) {
            border(live)
            ForEach(CanvasResizeCorner.allCases, id: \.self) { corner in
                handle(corner, at: corner.point(of: live))
                grabPad(corner, at: corner.point(of: grab))
            }
        }
        .frame(width: stageSize.width, height: stageSize.height)
    }

    private func border(_ box: CGRect) -> some View {
        Rectangle()
            .stroke(Color.yapperOrange, style: StrokeStyle(lineWidth: 1.5, dash: [6, 4]))
            .frame(width: box.width, height: box.height)
            .position(x: box.midX, y: box.midY)
            .allowsHitTesting(false)
    }

    /// The corner you can see. Takes no clicks: the pad under it does that.
    private func handle(_ corner: CanvasResizeCorner, at point: CGPoint) -> some View {
        RoundedRectangle(cornerRadius: 1.5, style: .continuous)
            .fill(Color.white)
            .overlay {
                RoundedRectangle(cornerRadius: 1.5, style: .continuous)
                    .stroke(Color.yapperOrange, lineWidth: 1.5)
            }
            .frame(width: 11, height: 11)
            .position(point)
            .allowsHitTesting(false)
    }

    /// The corner you can grab. Generous enough to hit without aiming.
    private func grabPad(_ corner: CanvasResizeCorner, at point: CGPoint) -> some View {
        Color.clear
            .frame(width: 24, height: 24)
            .contentShape(Rectangle())
            .cursor(.crosshair)
            .gesture(
                VideoFramingGesture(
                    session: session,
                    drag: drag,
                    stageSize: stageSize
                ).zoom(corner)
            )
            .position(point)
            .accessibilityLabel("Zoom video from \(corner.accessibilityName)")
    }
}

private extension CanvasResizeCorner {
    /// This corner of `box`.
    func point(of box: CGRect) -> CGPoint {
        CGPoint(
            x: xSign < 0 ? box.minX : box.maxX,
            y: ySign < 0 ? box.minY : box.maxY
        )
    }
}
