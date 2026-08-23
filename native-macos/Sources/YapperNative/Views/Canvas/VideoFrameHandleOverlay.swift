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
/// The four corners and the handle above the top edge take clicks. The box
/// itself is a line to look at: pushing the picture around is the pan area's
/// job, inside the stage, where it can sit under the overlays and the captions.
///
/// A turned picture turns the box with it, corners and all, so what you grab is
/// always the corner of the thing you can see.
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
        let angle = session.displayedFraming.rotation
        let grabAngle = drag.framingOrigin?.rotation ?? angle
        ZStack(alignment: .topLeading) {
            border(live)
            turnStalk(live, angle: angle)
            ForEach(CanvasResizeCorner.allCases, id: \.self) { corner in
                handle(corner, at: corner.point(of: live, turnedBy: angle))
                grabPad(corner, at: corner.point(of: grab, turnedBy: grabAngle))
            }
            turnRing(at: turnPoint(of: live, angle: angle))
            turnPad(at: turnPoint(of: grab, angle: grabAngle), centre: centre(of: grab))
        }
        .frame(width: stageSize.width, height: stageSize.height)
    }

    private func border(_ box: CGRect) -> some View {
        Rectangle()
            .stroke(Color.yapperOrange, style: StrokeStyle(lineWidth: 1.5, dash: [6, 4]))
            .frame(width: box.width, height: box.height)
            .rotationEffect(.degrees(session.displayedFraming.rotation))
            .position(x: box.midX, y: box.midY)
            .allowsHitTesting(false)
    }

    /// The line from the top edge out to the rotate handle, so the handle reads
    /// as belonging to the box rather than floating near it.
    private func turnStalk(_ box: CGRect, angle: Double) -> some View {
        let top = CGPoint(x: box.midX, y: box.minY).turned(by: angle, about: centre(of: box))
        let handle = turnPoint(of: box, angle: angle)
        return Path { path in
            path.move(to: top)
            path.addLine(to: handle)
        }
        .stroke(Color.yapperOrange, lineWidth: 1.5)
        .allowsHitTesting(false)
    }

    /// Where the rotate handle sits: straight out from the middle of the top
    /// edge, turned along with the picture.
    private func turnPoint(of box: CGRect, angle: Double) -> CGPoint {
        CGPoint(x: box.midX, y: box.minY - TurnHandle.reach)
            .turned(by: angle, about: centre(of: box))
    }

    private func centre(of box: CGRect) -> CGPoint {
        CGPoint(x: box.midX, y: box.midY)
    }

    /// The handle you can see, which sweeps round with the picture. Drawn as a
    /// ring rather than a square so it never reads as a fifth corner, and it
    /// takes no clicks: the pad under it does that.
    private func turnRing(at point: CGPoint) -> some View {
        TurnRing(diameter: 13).position(point)
    }

    /// The handle you can grab, which stands still for as long as it is held.
    ///
    /// For the reason the corner pads do, and more so: a rotate handle sweeps
    /// an arc, so a pad that travelled with the ring left the pointer behind
    /// within a few degrees, SwiftUI cancelled the drag and offered a fresh
    /// one, and every restart threw away the movement it began with. What that
    /// looked like was a picture turning a fraction of the way the pointer
    /// swept, in jumps.
    private func turnPad(at point: CGPoint, centre: CGPoint) -> some View {
        TurnPad { start, current, ended in
            turn(centre: centre, from: start, to: current, ended: ended)
        }
        .position(point)
        .accessibilityLabel("Rotate video")
    }

    private func turn(centre: CGPoint, from start: CGPoint, to current: CGPoint, ended: Bool) {
        VideoFramingGesture(session: session, drag: drag, stageSize: stageSize)
            .turn(centre: centre, from: start, to: current, ended: ended)
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
    /// This corner of `box`, turned with the picture.
    func point(of box: CGRect, turnedBy degrees: Double) -> CGPoint {
        CGPoint(
            x: xSign < 0 ? box.minX : box.maxX,
            y: ySign < 0 ? box.minY : box.maxY
        )
        .turned(by: degrees, about: CGPoint(x: box.midX, y: box.midY))
    }
}

private extension CGPoint {
    /// This point swung clockwise about another, which is the direction both
    /// the canvas and the composition turn in.
    func turned(by degrees: Double, about centre: CGPoint) -> CGPoint {
        guard degrees != 0 else { return self }
        let radians = degrees * .pi / 180
        let dx = Double(x - centre.x)
        let dy = Double(y - centre.y)
        return CGPoint(
            x: Double(centre.x) + dx * cos(radians) - dy * sin(radians),
            y: Double(centre.y) + dx * sin(radians) + dy * cos(radians)
        )
    }
}
