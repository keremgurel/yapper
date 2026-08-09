import CoreGraphics
import Foundation

/// Moving and resizing an overlay on the player canvas.
///
/// Pure arithmetic on fractions of the frame: the view hands over where the
/// gesture started and how far it has travelled, and gets back the overlay it
/// should draw. Nothing here touches the session, so every rule below is
/// testable without a player.
enum OverlayCanvasGeometry {
    /// How close, in points on screen, an edge must be before it settles.
    static let snapDistance = 9.0
    static let minimumWidth = 0.06
    static let maximumWidth = 1.4

    /// The overlay dragged by `translation`, kept inside the frame and settled
    /// onto the centre lines when it comes close enough.
    ///
    /// `shownAspect` is the shape of what the overlay actually draws. An
    /// overlay's box and its picture are not the same rectangle: a wide graphic
    /// in a tall box is fitted inside it, and the space left over is nothing at
    /// all. Snapping the box would settle an edge you cannot see against an
    /// edge of the frame and draw a line through the gap between them, so the
    /// picture is what settles when the shape is known.
    static func moved(
        overlay: ProjectOverlay,
        origin: CGPoint,
        translation: CGSize,
        canvasSize: CGSize,
        snapping: Bool = true,
        shownAspect: Double? = nil
    ) -> (overlay: ProjectOverlay, guides: [CanvasGuide]) {
        let width = max(1, Double(canvasSize.width))
        let height = max(1, Double(canvasSize.height))
        var moved = overlay
        var guides: [CanvasGuide] = []

        var x = origin.x + Double(translation.width) / width
        var y = origin.y + Double(translation.height) / height
        var horizontalGuide: Double?
        var verticalGuide: Double?

        if snapping {
            let shown = shownExtents(
                overlay: overlay,
                canvasSize: canvasSize,
                shownAspect: shownAspect
            )
            // The picture is centred in its box, so the two differ by half of
            // whatever the fitting left over. Snapped as the picture, saved as
            // the box.
            let inset = (x: (overlay.width - shown.width) / 2, y: (overlay.height - shown.height) / 2)

            let settledX = OverlaySnapEngine.snap(
                origin: x + inset.x,
                extent: shown.width,
                span: width
            )
            x = settledX.origin - inset.x
            verticalGuide = settledX.guide

            let settledY = OverlaySnapEngine.snap(
                origin: y + inset.y,
                extent: shown.height,
                span: height
            )
            y = settledY.origin - inset.y
            horizontalGuide = settledY.guide
        }

        moved.x = clampedOrigin(x, extent: overlay.width)
        moved.y = clampedOrigin(y, extent: overlay.height)

        // A line is only drawn when the snap survived being kept on the frame.
        // An overlay wider than the frame is centred whatever the drag says, and
        // a guide promising an alignment that was then overruled is a lie.
        if let verticalGuide, moved.x == x {
            guides.append(CanvasGuide(axis: .vertical, position: verticalGuide))
        }
        if let horizontalGuide, moved.y == y {
            guides.append(CanvasGuide(axis: .horizontal, position: horizontalGuide))
        }
        return (moved, guides)
    }

    /// How much of the box the picture fills, on each axis, as fractions of the
    /// frame. The whole box when the shape is unknown, which is the honest
    /// answer for a cutaway whose media has not been probed.
    private static func shownExtents(
        overlay: ProjectOverlay,
        canvasSize: CGSize,
        shownAspect: Double?
    ) -> (width: Double, height: Double) {
        guard let shownAspect, shownAspect > 0 else {
            return (overlay.width, overlay.height)
        }
        let width = max(1, Double(canvasSize.width))
        let height = max(1, Double(canvasSize.height))
        let box = CGRect(
            x: 0,
            y: 0,
            width: overlay.width * width,
            height: overlay.height * height
        )
        let fitted = OverlayFrame.fitted(box, mediaAspect: shownAspect)
        return (Double(fitted.width) / width, Double(fitted.height) / height)
    }

    /// The overlay resized from one corner. The media keeps its own shape, so
    /// a corner drag scales the card rather than squashing the picture, and the
    /// corner opposite the one being dragged stays where it is.
    static func resized(
        overlay: ProjectOverlay,
        translation: CGSize,
        corner: CanvasResizeCorner,
        canvasSize: CGSize,
        mediaAspect: Double,
        frameAspect: Double
    ) -> ProjectOverlay {
        let canvasWidth = max(1, Double(canvasSize.width))
        let projected = (
            Double(translation.width) * corner.xSign
                + Double(translation.height) * corner.ySign
        ) / 2
        let referenceWidth = max(48, canvasWidth * overlay.width)
        let scale = max(0.2, 1 + projected / referenceWidth)

        var resized = overlay
        resized.width = min(maximumWidth, max(minimumWidth, overlay.width * scale))
        resized.height = OverlayFrame.height(
            forWidth: resized.width,
            mediaAspect: mediaAspect,
            frameAspect: frameAspect
        )

        // Anchor the corner opposite the handle: growing from the top left
        // moves the box's origin, growing from the bottom right does not.
        if corner.xSign < 0 {
            resized.x = overlay.x + overlay.width - resized.width
        }
        if corner.ySign < 0 {
            resized.y = overlay.y + overlay.height - resized.height
        }
        resized.x = clampedOrigin(resized.x, extent: resized.width)
        resized.y = clampedOrigin(resized.y, extent: resized.height)
        return resized
    }

    /// The overlay resized to a share of the frame's width, centred on the box
    /// it had. What the size presets in the inspector do.
    static func scaled(
        overlay: ProjectOverlay,
        toWidth width: Double,
        mediaAspect: Double,
        frameAspect: Double
    ) -> ProjectOverlay {
        var scaled = overlay
        scaled.width = min(maximumWidth, max(minimumWidth, width))
        scaled.height = OverlayFrame.height(
            forWidth: scaled.width,
            mediaAspect: mediaAspect,
            frameAspect: frameAspect
        )
        scaled.x = clampedOrigin(
            overlay.x + (overlay.width - scaled.width) / 2,
            extent: scaled.width
        )
        scaled.y = clampedOrigin(
            overlay.y + (overlay.height - scaled.height) / 2,
            extent: scaled.height
        )
        return scaled
    }

    /// An overlay that covers the whole frame, for a straight cutaway.
    static func filling(overlay: ProjectOverlay) -> ProjectOverlay {
        var filled = overlay
        filled.x = 0
        filled.y = 0
        filled.width = 1
        filled.height = 1
        return filled
    }

    /// Keeps a box on the frame. An overlay wider than the frame is centred
    /// rather than pinned to one edge, which is what a deliberate blow-up wants.
    static func clampedOrigin(_ value: Double, extent: Double) -> Double {
        guard extent < 1 else { return (1 - extent) / 2 }
        return min(1 - extent, max(0, value))
    }
}
