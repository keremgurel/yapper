import CoreGraphics
import Foundation

/// The part of an overlay's media that is actually shown, in the media's own
/// fractions with the origin at its top left.
///
/// Cropping changes what an overlay shows without changing where it sits: the
/// box on the frame keeps its place, and the kept rectangle fills it.
struct OverlayCrop: Codable, Equatable, Sendable {
    var x: Double
    var y: Double
    var width: Double
    var height: Double

    /// The whole picture. What an overlay shows until someone crops it.
    static let full = OverlayCrop(x: 0, y: 0, width: 1, height: 1)

    /// No crop rectangle can be smaller than this fraction of the media.
    static let minimumSide = 0.05

    var isFull: Bool {
        x == 0 && y == 0 && width == 1 && height == 1
    }

    /// A rectangle kept inside the media and never below the minimum.
    var clamped: OverlayCrop {
        let width = min(1, max(Self.minimumSide, self.width))
        let height = min(1, max(Self.minimumSide, self.height))
        return OverlayCrop(
            x: min(1 - width, max(0, x)),
            y: min(1 - height, max(0, y)),
            width: width,
            height: height
        )
    }

    /// The rectangle with one corner moved and the other three left alone.
    func resized(corner: CanvasResizeCorner, dx: Double, dy: Double) -> OverlayCrop {
        let right = x + width
        let bottom = y + height
        let left = corner.xSign < 0 ? x + dx : x
        let top = corner.ySign < 0 ? y + dy : y
        let newRight = corner.xSign > 0 ? right + dx : right
        let newBottom = corner.ySign > 0 ? bottom + dy : bottom
        return OverlayCrop(
            x: left,
            y: top,
            width: newRight - left,
            height: newBottom - top
        ).clamped
    }

    func moved(dx: Double, dy: Double) -> OverlayCrop {
        OverlayCrop(x: x + dx, y: y + dy, width: width, height: height).clamped
    }

    /// Where the whole media sits inside its box, as fractions of that box, so
    /// the kept rectangle covers the box exactly. The view draws the media at
    /// this size and offset inside a clipped frame; with no crop it reduces to
    /// the media filling the box.
    func mediaPlacement(mediaAspect: Double, boxAspect: Double) -> (
        x: Double,
        y: Double,
        width: Double,
        height: Double
    ) {
        guard mediaAspect > 0, boxAspect > 0, width > 0, height > 0 else {
            return (0, 0, 1, 1)
        }
        // The shape of what the crop left behind.
        let croppedAspect = mediaAspect * (width / height)
        // Cover: the kept rectangle matches the box on one axis and overflows
        // on the other. Sizes here are fractions of the box.
        let coverWidth = croppedAspect >= boxAspect ? croppedAspect / boxAspect : 1
        let coverHeight = croppedAspect >= boxAspect ? 1 : boxAspect / croppedAspect
        let mediaWidth = coverWidth / width
        let mediaHeight = coverHeight / height
        return (
            x: -x * mediaWidth + (1 - coverWidth) / 2,
            y: -y * mediaHeight + (1 - coverHeight) / 2,
            width: mediaWidth,
            height: mediaHeight
        )
    }

    /// The crop as a rectangle of the source in pixels, with the origin at the
    /// bottom left, which is what AVFoundation and Core Animation both want.
    func sourceRect(inPixelSize size: CGSize) -> CGRect {
        CGRect(
            x: x * size.width,
            y: (1 - y - height) * size.height,
            width: width * size.width,
            height: height * size.height
        )
    }
}
