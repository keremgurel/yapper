import CoreGraphics
import Foundation
import QuartzCore

/// The face of a number node: the string for a progress and the bitmap for a
/// string, rendered once per distinct string and remembered.
///
/// Every face is drawn on a canvas of the same size so the layer never moves
/// while the digits change, and so the export can swap `contents` with a
/// discrete keyframe animation instead of re-laying anything out.
final class SceneCounterFace {
    let layer: CALayer
    private let node: SceneNode
    private let style: SceneTextRasterizer.Style
    private let width: CGFloat
    private let canvasHeight: CGFloat
    private var cache: [String: CGImage] = [:]

    init(node: SceneNode, style: SceneTextRasterizer.Style, width: CGFloat, maximumHeight: CGFloat) {
        self.node = node
        self.style = style
        self.width = width
        // The tallest of the two ends is as tall as any face gets: the
        // formats only ever change the digits, never the number of lines,
        // unless the box is too narrow, in which case both ends wrap alike.
        let ends = [0.0, 1.0].map { progress in
            SceneTextRasterizer.measure(
                Self.string(for: node, progress: progress),
                style: style,
                width: width,
                maximumHeight: maximumHeight
            ).height
        }
        canvasHeight = max(style.lineHeight, ends.max() ?? style.lineHeight)
        layer = CALayer()
        layer.contentsScale = SceneTextRasterizer.scale
        layer.anchorPoint = CGPoint(x: 0, y: 1)
    }

    /// The bitmap's size in points, once one has been drawn.
    private(set) var renderedSize: CGSize = .zero
    private(set) var bleed: CGFloat = 0

    func string(at progress: Double) -> String {
        Self.string(for: node, progress: progress)
    }

    static func string(for node: SceneNode, progress: Double) -> String {
        let from = node.from ?? 0
        let to = node.to ?? from
        let value = from + (to - from) * progress
        return SceneNumberFormatter.format(
            value: value,
            format: node.format ?? .grouped,
            prefix: node.prefix,
            suffix: node.suffix
        )
    }

    func image(for string: String) -> CGImage? {
        if let cached = cache[string] { return cached }
        guard let rendering = SceneTextRasterizer.render(
            string,
            style: style,
            width: width,
            maximumHeight: canvasHeight,
            canvasHeight: canvasHeight,
            maximumPixels: 128 * 1024
        ) else { return nil }
        // The animation owns its sampled faces. Keep only the most recent
        // lookup here so scrubbing never grows a second unbounded cache.
        cache = [string: rendering.image]
        renderedSize = rendering.size
        bleed = rendering.bleed
        return rendering.image
    }

    /// Puts the face for `progress` on the layer as its model contents.
    func show(progress: Double) {
        let text = string(at: progress)
        layer.contents = image(for: text)
        layer.bounds = CGRect(origin: .zero, size: renderedSize)
        layer.setValue(bleed, forKey: SceneNodeLayer.bleedKey)
    }
}
