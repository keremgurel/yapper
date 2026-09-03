import Foundation
import QuartzCore

/// Turns a scene into the Core Animation layer tree every renderer draws.
///
/// The preview hosts the tree over the player and scrubs it with `timeOffset`;
/// the export adds it to the animation tool with a `beginTime` in composition
/// time; the library poster renders it once at a moment. All three get their
/// values from `SceneTimeline`, so a number that reads 2,850 at 1.6 seconds
/// reads 2,850 at 1.6 seconds everywhere.
enum SceneLayerBuilder {
    enum Mode: Sendable {
        /// Every animated property resolved at one moment, nothing animating.
        case still(at: Double)
        /// Keyframe animations sampled from the timeline, starting at
        /// `beginTime` in the host layer's clock. The preview passes a value
        /// just above zero and drives `timeOffset`; the export passes
        /// `AVCoreAnimationBeginTimeAtZero + overlay.timelineStart`.
        case animated(beginTime: CFTimeInterval)
    }

    /// The tree for `scene` drawn into `size` points, origin at the bottom
    /// left the way Core Animation measures.
    static func makeLayer(
        scene: OverlayScene,
        size: CGSize,
        palette: ScenePalette,
        assets: any SceneAssetResolving,
        mode: Mode
    ) -> CALayer {
        // Setting model values must never animate: a preview scrubbing from
        // one frame to the next would otherwise ease between them.
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        defer { CATransaction.commit() }

        let root = CALayer()
        root.frame = CGRect(origin: .zero, size: size)
        root.masksToBounds = true

        if let background = scene.background {
            let card = CALayer()
            card.frame = root.bounds
            card.backgroundColor = background.fill.resolved(with: palette).cgColor
            card.cornerRadius = SceneGeometry.cornerRadius(background.cornerRadius, sceneSize: size, in: size)
            card.opacity = Float(min(1, max(0, background.opacity)))
            root.addSublayer(card)
        }

        let timeline = SceneTimeline(scene: scene)
        let context = SceneRenderContext(
            timeline: timeline,
            sceneSize: size,
            palette: palette,
            assets: assets,
            icons: SceneIconCatalog.shared
        )
        let time: Double
        switch mode {
        case let .still(at: moment): time = min(scene.duration, max(0, moment))
        case .animated: time = 0
        }

        for node in scene.nodes {
            guard let built = SceneNodeLayerFactory.make(
                node: node,
                parentSize: size,
                context: context,
                time: time
            ) else { continue }
            root.addSublayer(built.layer)
            if case let .animated(beginTime) = mode {
                SceneAnimationBaker.bake(built, timeline: timeline, beginTime: beginTime)
            }
        }
        return root
    }
}
