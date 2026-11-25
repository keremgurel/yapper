import CoreGraphics
import Foundation

/// How far the player has to be pushed, turned and scaled for the picture
/// already on screen to look like the framing that is wanted. The offset is in
/// points on the stage, the rotation in degrees clockwise.
struct FramingPreview: Equatable, Sendable {
    var scale: Double
    var rotation: Double
    var offset: CGSize
}

/// Panning, zooming and turning the main track's picture inside the output
/// frame.
///
/// Pure arithmetic on fractions of the frame, like `OverlayCanvasGeometry`: the
/// view hands over the framing the gesture started from and how far it has
/// travelled, and gets back the framing to draw.
enum VideoFramingGeometry {
    /// How close, in points on screen, the picture has to come to centred
    /// before it settles there.
    static let snapDistance = 9.0

    /// The picture slid by `translation`, settling onto the lines of the frame
    /// worth landing on exactly when it comes close enough to one.
    ///
    /// The same lines the overlays settle onto, caught by the same three parts
    /// of the picture: its leading edge, its middle and its trailing edge. This
    /// used to catch the middle and nothing else, which meant that lining a
    /// zoomed-in picture up flush with the top of the frame, so no black shows
    /// above the speaker, was a thing you could only do by eye.
    ///
    /// `sourceAspect` is the shape of the footage, which is what says where the
    /// picture's own edges are: it is fitted inside the frame before it is
    /// zoomed, so at 100% a wide clip in a tall frame has its edges nowhere near
    /// the frame's. Left out, the picture is taken to be the shape of the frame.
    static func panned(
        framing: VideoFraming,
        translation: CGSize,
        canvasSize: CGSize,
        sourceAspect: Double? = nil,
        snapping: Bool = true
    ) -> (framing: VideoFraming, guides: [CanvasGuide]) {
        let width = max(1, Double(canvasSize.width))
        let height = max(1, Double(canvasSize.height))

        let slid = framing.with(
            x: framing.x + Double(translation.width) / width,
            y: framing.y + Double(translation.height) / height
        )
        guard snapping else { return (slid, []) }

        // Where the picture sits after the slide, measured the way the snap
        // engine measures an overlay: a leading edge and a size, in fractions
        // of the frame.
        let box = mediaBox(
            framing: slid,
            sourceAspect: sourceAspect ?? width / height,
            stageSize: canvasSize
        )
        let settledX = OverlaySnapEngine.snap(
            origin: Double(box.minX) / width,
            extent: Double(box.width) / width,
            span: width
        )
        let settledY = OverlaySnapEngine.snap(
            origin: Double(box.minY) / height,
            extent: Double(box.height) / height,
            span: height
        )

        var guides: [CanvasGuide] = []
        if let guide = settledX.guide {
            guides.append(CanvasGuide(axis: .vertical, position: guide))
        }
        if let guide = settledY.guide {
            guides.append(CanvasGuide(axis: .horizontal, position: guide))
        }
        // Back from where the picture's edge landed to where its middle is,
        // which is what the framing stores.
        return (
            slid.with(
                x: slid.x + settledX.origin - Double(box.minX) / width,
                y: slid.y + settledY.origin - Double(box.minY) / height
            ),
            guides
        )
    }

    /// How close, in degrees, a turn has to come to a quarter of the way round
    /// before it settles there. Straight, sideways and upside down are the
    /// angles anyone is actually aiming for.
    static let rotationSnapDegrees = 5.0

    /// The picture turned by dragging the rotate handle, measured as the angle
    /// the pointer has swept about the middle of the picture rather than as a
    /// distance, so the handle stays under the pointer however far out it is
    /// dragged.
    static func rotated(
        framing: VideoFraming,
        centre: CGPoint,
        from start: CGPoint,
        to current: CGPoint,
        snapping: Bool = true
    ) -> VideoFraming {
        let swept = angle(at: current, about: centre) - angle(at: start, about: centre)
        var rotation = VideoFraming.wrap(framing.rotation + swept)
        if snapping {
            let quarter = (rotation / 90).rounded() * 90
            if abs(rotation - quarter) <= rotationSnapDegrees { rotation = quarter }
        }
        return framing.with(rotation: rotation)
    }

    /// Where a point stands relative to a centre, in degrees clockwise from
    /// straight up, which is where the rotate handle sits.
    static func angle(at point: CGPoint, about centre: CGPoint) -> Double {
        let dx = Double(point.x - centre.x)
        let dy = Double(point.y - centre.y)
        guard dx != 0 || dy != 0 else { return 0 }
        return atan2(dx, -dy) * 180 / .pi
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
        // Along the picture's own axes, not the screen's. A corner of a turned
        // picture points somewhere else, and pulling it outwards has to grow
        // the picture whichever way "outwards" happens to be.
        let radians = -framing.rotationRadians
        let along = CGSize(
            width: Double(translation.width) * cos(radians)
                - Double(translation.height) * sin(radians),
            height: Double(translation.width) * sin(radians)
                + Double(translation.height) * cos(radians)
        )
        let projected = (
            Double(along.width) * corner.xSign
                + Double(along.height) * corner.ySign
        ) / 2
        // Measured against the frame rather than against the current scale, so
        // a drag of the same length does the same thing however far in you
        // already are, instead of accelerating the further you go.
        return framing.with(scale: framing.scale + 2 * projected / reference)
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
        to wanted: VideoFraming,
        stageSize: CGSize
    ) -> FramingPreview? {
        guard rendered != wanted else { return nil }
        let scale = wanted.scale / rendered.scale
        let turn = VideoFraming.wrap(wanted.rotation - rendered.rotation)
        let radians = turn * .pi / 180
        // The offset is worked out in points rather than in fractions of the
        // frame because turning mixes the two axes together, and a stage that
        // is taller than it is wide would shear rather than turn if the two
        // were treated as the same unit.
        let carried = CGPoint(
            x: rendered.x * Double(stageSize.width),
            y: rendered.y * Double(stageSize.height)
        )
        let moved = CGPoint(
            x: scale * (cos(radians) * carried.x - sin(radians) * carried.y),
            y: scale * (sin(radians) * carried.x + cos(radians) * carried.y)
        )
        return FramingPreview(
            scale: scale,
            rotation: turn,
            offset: CGSize(
                width: wanted.x * Double(stageSize.width) - moved.x,
                height: wanted.y * Double(stageSize.height) - moved.y
            )
        )
    }

    /// The zoom that makes the picture cover the whole output frame with
    /// nothing left over, for footage whose shape does not match it. This is
    /// what "Fill frame" does, and the reason the feature exists: landscape
    /// footage in a portrait frame is fitted to a letterbox by default.
    static func fillingScale(
        sourceAspect: Double,
        frameAspect: Double,
        rotation: Double = 0
    ) -> Double {
        guard sourceAspect > 0, frameAspect > 0 else { return 1 }
        // The frame, in units where it is one tall.
        let frameWidth = frameAspect
        let frameHeight = 1.0
        // The picture at 100%, which is the fit: whichever side runs out first
        // touches the frame and the other falls short.
        let fittedWidth = sourceAspect >= frameAspect ? frameWidth : frameHeight * sourceAspect
        let fittedHeight = sourceAspect >= frameAspect ? frameWidth / sourceAspect : frameHeight

        // A turned picture covers the frame exactly when the frame, turned back
        // the other way, fits inside the upright picture. Which is the frame's
        // own box measured along the picture's axes.
        let radians = abs(rotation) * .pi / 180
        let across = abs(cos(radians))
        let down = abs(sin(radians))
        let needsWidth = frameWidth * across + frameHeight * down
        let needsHeight = frameWidth * down + frameHeight * across
        return max(needsWidth / fittedWidth, needsHeight / fittedHeight)
    }
}
