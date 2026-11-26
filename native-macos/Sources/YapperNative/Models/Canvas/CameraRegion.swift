import CoreGraphics
import Foundation

/// The part of the frame the speaker's footage is drawn in, for a layout that
/// gives the camera only part of the picture: a split with the camera in the
/// bottom half and something else on top.
///
/// Fractions of the output frame from its top left, like an overlay's box.
/// Inside it the footage is scaled to cover the whole area and centred, so a
/// clip's `VideoFraming` keeps meaning what it means on a full frame, measured
/// against this area instead: scale 1 fills it, and `x` and `y` slide the
/// picture by fractions of its width and height. Nothing outside it shows the
/// footage; the project backdrop and the overlays fill the rest.
///
/// A project without one draws the footage on the whole frame, fitted, which
/// is what every project did before layouts existed.
struct CameraRegion: Codable, Equatable, Sendable {
    private(set) var x: Double
    private(set) var y: Double
    private(set) var width: Double
    private(set) var height: Double

    /// Smaller than this and the speaker stops being a speaker.
    static let minimumExtent = 0.15

    init(x: Double, y: Double, width: Double, height: Double) {
        let width = Self.clamped(width, in: Self.minimumExtent ... 1)
        let height = Self.clamped(height, in: Self.minimumExtent ... 1)
        self.width = width
        self.height = height
        self.x = Self.clamped(x, in: 0 ... (1 - width))
        self.y = Self.clamped(y, in: 0 ... (1 - height))
    }

    /// The area in pixels of a frame this size, origin at the top left.
    func rect(in size: CGSize) -> CGRect {
        CGRect(
            x: size.width * x,
            y: size.height * y,
            width: size.width * width,
            height: size.height * height
        )
    }

    /// The camera below `seam` and nothing above it.
    static func below(seam: Double) -> CameraRegion {
        let top = clamped(seam, in: 0 ... (1 - minimumExtent))
        return CameraRegion(x: 0, y: top, width: 1, height: 1 - top)
    }

    private static func clamped(_ value: Double, in range: ClosedRange<Double>) -> Double {
        guard value.isFinite else { return range.lowerBound }
        return min(range.upperBound, max(range.lowerBound, value))
    }
}

extension CameraRegion {
    private enum CodingKeys: String, CodingKey { case x, y, width, height }

    /// Through the clamping initialiser, so a hand-edited project file cannot
    /// put the camera outside the frame.
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.init(
            x: try container.decode(Double.self, forKey: .x),
            y: try container.decode(Double.self, forKey: .y),
            width: try container.decode(Double.self, forKey: .width),
            height: try container.decode(Double.self, forKey: .height)
        )
    }
}

/// The framing that puts a take into a camera region the way the style
/// library's split draws it in the gallery: covering the area, zoomed by
/// `zoom` about the line `focusY` of the take, which stays put.
///
/// That is CSS `object-fit: cover`, `object-position: 50% focusY` and
/// `scale(zoom)` about the same point. The editor zooms about the middle of the
/// area and then slides, so the slide is worked out here from the take's shape.
enum CameraRegionFraming {
    static func framing(
        zoom: Double,
        focusY: Double,
        sourceAspect: Double,
        region: CameraRegion,
        frameAspect: Double
    ) -> VideoFraming {
        let focus = min(1, max(0, focusY))
        guard sourceAspect > 0, frameAspect > 0 else { return VideoFraming(scale: zoom, x: 0, y: 0) }
        // How much taller the covering picture is than the area. A take wider
        // than the area fills it by height and loses its sides instead.
        let regionAspect = region.width * frameAspect / region.height
        let overflow = max(1, regionAspect / sourceAspect)
        return VideoFraming(scale: zoom, x: 0, y: (focus - 0.5) * (1 - zoom * overflow))
    }
}
