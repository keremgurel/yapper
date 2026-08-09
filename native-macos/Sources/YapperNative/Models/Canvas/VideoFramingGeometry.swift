import CoreGraphics
import Foundation

/// Panning and zooming the main track's picture inside the output frame.
///
/// Pure arithmetic on fractions of the frame, like `OverlayCanvasGeometry`: the
/// view hands over the framing the gesture started from and how far it has
/// travelled, and gets back the framing to draw.
enum VideoFramingGeometry {
    /// How close, in points on screen, the picture has to come to centred
    /// before it settles there.
    static let snapDistance = 9.0

    /// The picture slid by `translation`, settling onto the centre of the frame
    /// on either axis when it comes close enough.
    static func panned(
        framing: VideoFraming,
        translation: CGSize,
        canvasSize: CGSize,
        snapping: Bool = true
    ) -> (framing: VideoFraming, guides: [CanvasGuide]) {
        let width = max(1, Double(canvasSize.width))
        let height = max(1, Double(canvasSize.height))

        var x = framing.x + Double(translation.width) / width
        var y = framing.y + Double(translation.height) / height
        var guides: [CanvasGuide] = []

        if snapping {
            if abs(x) * width <= snapDistance {
                x = 0
                guides.append(CanvasGuide(axis: .vertical, position: 0.5))
            }
            if abs(y) * height <= snapDistance {
                y = 0
                guides.append(CanvasGuide(axis: .horizontal, position: 0.5))
            }
        }

        return (VideoFraming(scale: framing.scale, x: x, y: y), guides)
    }

    /// The picture zoomed by dragging `corner`.
    ///
    /// Pulling a corner outwards grows the picture and pushing it inwards
    /// shrinks it, which is why the two axes are projected onto the corner's
    /// own diagonal rather than either one being taken alone. The centre stays
    /// put: this is a zoom, not a resize of a box, and the thing being framed
    /// is almost always near the middle.
    static func zoomed(
        framing: VideoFraming,
        translation: CGSize,
        corner: CanvasResizeCorner,
        canvasSize: CGSize
    ) -> VideoFraming {
        let reference = max(48, Double(canvasSize.width))
        let projected = (
            Double(translation.width) * corner.xSign
                + Double(translation.height) * corner.ySign
        ) / 2
        // Measured against the frame rather than against the current scale, so
        // a drag of the same length does the same thing however far in you
        // already are, instead of accelerating the further you go.
        return VideoFraming(
            scale: framing.scale + 2 * projected / reference,
            x: framing.x,
            y: framing.y
        )
    }

    /// Where the picture actually sits on the stage: fitted into the output
    /// frame, zoomed about the middle of it, then slid. The same three steps
    /// the composition takes, in the canvas's own points.
    ///
    /// The framing box is drawn around this rather than around the output
    /// frame, so the corners you pull are the corners of the thing being
    /// resized. Zoomed past the frame the box hangs outside the stage, which is
    /// what the workspace zoom is for.
    static func mediaBox(
        framing: VideoFraming,
        sourceAspect: Double,
        stageSize: CGSize
    ) -> CGRect {
        let stageWidth = max(1, Double(stageSize.width))
        let stageHeight = max(1, Double(stageSize.height))
        let aspect = sourceAspect > 0 ? sourceAspect : stageWidth / stageHeight

        var width = stageWidth
        var height = stageWidth / aspect
        if height > stageHeight {
            height = stageHeight
            width = stageHeight * aspect
        }
        width *= framing.scale
        height *= framing.scale

        let centreX = stageWidth / 2 + framing.x * stageWidth
        let centreY = stageHeight / 2 + framing.y * stageHeight
        return CGRect(
            x: centreX - width / 2,
            y: centreY - height / 2,
            width: width,
            height: height
        )
    }

    /// How the picture already on screen has to be pushed for a composition
    /// built with `rendered` to look like `wanted`.
    ///
    /// Framing is really done by rebuilding the composition, which takes long
    /// enough that doing it per mouse event would stutter. So between asking
    /// for a framing and getting it, the player is told to fake the difference:
    /// scale by the ratio, then slide by whatever is left over once that
    /// scaling has carried the existing offset with it. `nil` when the two
    /// agree, which is the steady state and means the player is drawn untouched.
    static func previewTransform(
        from rendered: VideoFraming,
        to wanted: VideoFraming
    ) -> (scale: Double, x: Double, y: Double)? {
        guard rendered != wanted else { return nil }
        let scale = wanted.scale / rendered.scale
        return (scale, wanted.x - rendered.x * scale, wanted.y - rendered.y * scale)
    }

    /// The zoom that makes the picture cover the whole output frame with
    /// nothing left over, for footage whose shape does not match it. This is
    /// what "Fill frame" does, and the reason the feature exists: landscape
    /// footage in a portrait frame is fitted to a letterbox by default.
    static func fillingScale(sourceAspect: Double, frameAspect: Double) -> Double {
        guard sourceAspect > 0, frameAspect > 0 else { return 1 }
        // Fitting already scaled the picture by the smaller of the two ratios.
        // Covering needs the larger, so the zoom is the one divided by the
        // other, whichever way round the two shapes happen to be.
        return max(sourceAspect / frameAspect, frameAspect / sourceAspect)
    }
}
