import CoreGraphics
import Foundation
import QuartzCore

/// One frame of a scene as a bitmap: the library still, the timeline
/// thumbnail, and the picture a bin row shows before anything plays.
///
/// Draws the same layer tree the export burns in, resolved at one moment, so
/// the poster is a frame of the finished video and not an approximation of it.
enum ScenePosterRenderer {
    /// The long side is capped here: a poster is looked at in a bin row and a
    /// timeline thumbnail, never at export size.
    static let maximumSide: CGFloat = 2048

    /// The scene at `time` (its `poster` time when nil), drawn into `size`
    /// pixels. Nil only when a bitmap context cannot be made.
    static func render(
        scene: OverlayScene,
        size: CGSize,
        palette: ScenePalette,
        assets: any SceneAssetResolving,
        at time: Double? = nil
    ) -> CGImage? {
        let longSide = max(size.width, size.height)
        guard longSide > 0, size.width > 0, size.height > 0 else { return nil }
        let scale = min(1, maximumSide / longSide)
        let pixels = CGSize(
            width: max(1, (size.width * scale).rounded(.down)),
            height: max(1, (size.height * scale).rounded(.down))
        )
        // Built at pixel size, so every fraction lands on a pixel and nothing
        // is scaled on the way into the bitmap.
        let layer = SceneLayerBuilder.makeLayer(
            scene: scene,
            size: pixels,
            palette: palette,
            assets: assets,
            mode: .still(at: time ?? scene.poster)
        )
        guard let context = CGContext(
            data: nil,
            width: Int(pixels.width),
            height: Int(pixels.height),
            bitsPerComponent: 8,
            bytesPerRow: 0,
            space: CGColorSpace(name: CGColorSpace.sRGB)!,
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else { return nil }
        // A bitmap context and a layer both count from the bottom left, so
        // the tree renders straight in. The flip from the scene's own top-left
        // fractions has already happened, once, in `SceneGeometry`.
        layer.render(in: context)
        return context.makeImage()
    }
}
