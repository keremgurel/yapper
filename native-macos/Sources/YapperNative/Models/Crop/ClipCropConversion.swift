import CoreGraphics
import Foundation

/// Cropping a main-track clip, in the terms the clip actually stores.
///
/// A clip has no crop rectangle. It has a `VideoFraming`: a zoom and an offset
/// that decide where the output frame lands on the source picture. Those are
/// the same information as a rectangle, said differently, so the crop editor
/// speaks rectangles and this translates.
///
/// One thing follows from that and shapes the whole feature: the part of a clip
/// that survives is whatever the output frame lands on, so it always has the
/// output frame's shape. There is no framing that shows a square of a landscape
/// clip and black around it. The editor holds a clip's crop to the frame's
/// shape rather than offering presets it could not honour.
///
/// The arithmetic mirrors `CompositionBuilder.fittedTransform`: fit the picture
/// into the frame, zoom about the middle, then slide.
enum ClipCropConversion {
    /// The part of the source that the output frame is currently showing.
    static func crop(
        from framing: VideoFraming,
        sourceAspect: Double,
        frameAspect: Double
    ) -> OverlayCrop {
        guard sourceAspect > 0, frameAspect > 0 else { return .full }
        let drawn = drawnSize(scale: framing.scale, sourceAspect: sourceAspect, frameAspect: frameAspect)
        guard drawn.width > 0, drawn.height > 0 else { return .full }

        // Where the picture's top left sits, in the same units as the frame,
        // which is `frameAspect` wide and 1 tall.
        let left = frameAspect / 2 + framing.x * frameAspect - drawn.width / 2
        let top = 0.5 + framing.y - drawn.height / 2

        let x0 = -left / drawn.width
        let x1 = (frameAspect - left) / drawn.width
        let y0 = -top / drawn.height
        let y1 = (1 - top) / drawn.height

        return rectangle(fromX: x0, toX: x1, fromY: y0, toY: y1)
    }

    /// The framing that puts this rectangle on screen, centred.
    ///
    /// A rectangle that is not the frame's shape is fitted, which means the
    /// frame will also show whatever source lies beside it. The editor does not
    /// hand one of those over; this stays well defined anyway rather than
    /// pretending the case cannot arise.
    static func framing(
        for crop: OverlayCrop,
        sourceAspect: Double,
        frameAspect: Double
    ) -> VideoFraming {
        guard
            sourceAspect > 0,
            frameAspect > 0,
            crop.width > 0,
            crop.height > 0
        else { return .identity }

        let unit = drawnSize(scale: 1, sourceAspect: sourceAspect, frameAspect: frameAspect)
        guard unit.width > 0, unit.height > 0 else { return .identity }

        // The zoom that makes the kept rectangle as large as the frame allows.
        let scale = min(
            frameAspect / (crop.width * unit.width),
            1 / (crop.height * unit.height)
        )
        let drawn = CGSize(width: unit.width * scale, height: unit.height * scale)

        // Slide until the kept rectangle's middle is the frame's middle.
        let x = drawn.width * (0.5 - crop.x - crop.width / 2) / frameAspect
        let y = drawn.height * (0.5 - crop.y - crop.height / 2)
        return VideoFraming(scale: scale, x: x, y: y)
    }

    /// The smallest crop a clip can actually hold, as a fraction of its width.
    ///
    /// `VideoFraming` clamps its zoom, so past a certain point a rectangle is
    /// one the clip cannot store. The editor stops the drag here rather than
    /// accepting a number that will be quietly clamped into something else.
    static func minimumSide(sourceAspect: Double, frameAspect: Double) -> Double {
        guard sourceAspect > 0, frameAspect > 0 else { return 0.05 }
        let unit = drawnSize(scale: 1, sourceAspect: sourceAspect, frameAspect: frameAspect)
        guard unit.width > 0, unit.height > 0 else { return 0.05 }
        // At maximum zoom the frame covers this much of the picture on each
        // axis; the tighter of the two is the floor.
        let byWidth = frameAspect / (unit.width * VideoFraming.maximumScale)
        let byHeight = 1 / (unit.height * VideoFraming.maximumScale)
        return min(1, max(byWidth, byHeight))
    }

    /// The rectangle of the source with the output frame's own shape, closest
    /// to the one asked for. What a clip's crop is always held to.
    static func frameShaped(
        _ crop: OverlayCrop,
        sourceAspect: Double,
        frameAspect: Double
    ) -> OverlayCrop {
        guard
            let ratio = CropGeometry.fractionRatio(
                forRealRatio: frameAspect,
                sourceAspect: sourceAspect
            )
        else { return crop }
        return CropGeometry.fitted(
            crop,
            to: ratio,
            minimumSide: minimumSide(sourceAspect: sourceAspect, frameAspect: frameAspect)
        )
    }

    /// How big the source is drawn, in a frame that is `frameAspect` wide and
    /// 1 tall, at a given zoom. Fitted first, exactly as the compositor does.
    private static func drawnSize(
        scale: Double,
        sourceAspect: Double,
        frameAspect: Double
    ) -> CGSize {
        let fit = min(frameAspect / sourceAspect, 1)
        return CGSize(width: sourceAspect * fit * scale, height: fit * scale)
    }

    private static func rectangle(
        fromX x0: Double,
        toX x1: Double,
        fromY y0: Double,
        toY y1: Double
    ) -> OverlayCrop {
        let left = min(max(0, x0), 1)
        let right = min(max(0, x1), 1)
        let top = min(max(0, y0), 1)
        let bottom = min(max(0, y1), 1)
        return OverlayCrop(
            x: left,
            y: top,
            width: max(0.001, right - left),
            height: max(0.001, bottom - top)
        )
    }
}
