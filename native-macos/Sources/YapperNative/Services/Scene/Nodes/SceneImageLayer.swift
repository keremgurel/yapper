import Foundation
import QuartzCore

/// A picture the design asked for: the brand logo or a generated image, read
/// from the asset folder beside the scene file. A picture that is not there
/// resolves to no layer at all rather than an empty box, which is what the
/// validator's note about it already promised.
enum SceneImageLayer {
    static func make(node: SceneNode, context: SceneRenderContext) -> SceneNodeLayer? {
        guard let asset = node.asset, let image = context.assets.image(forAsset: asset) else { return nil }
        let layer = CALayer()
        layer.contents = image
        layer.contentsGravity = node.fit == .cover ? .resizeAspectFill : .resizeAspect
        layer.masksToBounds = true
        let radius = node.cornerRadius ?? 0
        return SceneNodeLayer(
            node: node,
            parentSize: .zero,
            layer: layer,
            layout: { size in
                layer.cornerRadius = SceneGeometry.cornerRadius(radius, sceneSize: context.sceneSize, in: size)
            }
        )
    }
}
