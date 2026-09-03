import CoreGraphics
import Foundation

/// What every node needs to know about the scene it is drawn in.
struct SceneRenderContext {
    let timeline: SceneTimeline
    /// The whole scene's box in points. Font sizes, stroke widths and corner
    /// radii are fractions of its height wherever the node sits.
    let sceneSize: CGSize
    let palette: ScenePalette
    let assets: any SceneAssetResolving
    let icons: SceneIconCatalog

    func color(_ color: SceneColor?) -> CGColor? {
        color?.resolved(with: palette).cgColor
    }

    func length(_ fraction: Double?) -> CGFloat {
        SceneGeometry.length(fraction ?? 0, sceneSize: sceneSize)
    }

    func strokeWidth(of node: SceneNode) -> CGFloat {
        length(node.strokeWidth ?? 0.01)
    }
}
