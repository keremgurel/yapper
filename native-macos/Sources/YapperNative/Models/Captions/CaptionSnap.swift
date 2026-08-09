import CoreGraphics
import Foundation

/// Settles a dragged caption onto the handful of positions worth hitting
/// exactly, and reports which lines to draw.
///
/// Thresholds are measured in points rather than stage fractions so the pull
/// feels identical whether the player is a thumbnail or filling the window.
enum CaptionSnapEngine {
    /// How close, in points on screen, a card must be before it settles.
    static let snapDistance = 9.0

    static let xTargets: [Double] = [0.5]

    static var yTargets: [Double] {
        [1.0 / 3.0, 0.5, 2.0 / 3.0, TextStyle.default.y]
    }

    static func snap(
        x: Double,
        y: Double,
        canvasSize: CGSize,
        enabled: Bool = true
    ) -> (x: Double, y: Double, guides: [CanvasGuide]) {
        guard enabled, canvasSize.width > 0, canvasSize.height > 0 else {
            return (x, y, [])
        }
        var guides: [CanvasGuide] = []
        var snappedX = x
        var snappedY = y

        if let target = nearestTarget(xTargets, to: x, span: Double(canvasSize.width)) {
            snappedX = target
            guides.append(CanvasGuide(axis: .vertical, position: target))
        }
        if let target = nearestTarget(yTargets, to: y, span: Double(canvasSize.height)) {
            snappedY = target
            guides.append(CanvasGuide(axis: .horizontal, position: target))
        }
        return (snappedX, snappedY, guides)
    }

    private static func nearestTarget(
        _ targets: [Double],
        to value: Double,
        span: Double
    ) -> Double? {
        targets
            .filter { abs($0 - value) * span <= snapDistance }
            .min { abs($0 - value) < abs($1 - value) }
    }
}
