@preconcurrency import AVFoundation
import AppKit
import Foundation
import QuartzCore

/// A scene overlay as the layer the export's animation tool burns in.
///
/// Sits beside the image overlays in `CompositionBuilder.applyVisualLayers`
/// and follows the same rules for where it goes, when it shows and how it
/// moves, except that its picture is a layer tree rather than a bitmap, which
/// changes how it has to move: see `applyMotion`.
enum SceneExportLayer {
    /// The scene a generated overlay's media points at. Fails closed like a
    /// corrupt image does, so a design that cannot be read stops the export
    /// instead of silently leaving a hole in it.
    static func loadScene(for media: ProjectMedia) throws -> OverlayScene {
        guard MediaAvailability.isRegularReadableFile(media.url),
              let data = try? Data(contentsOf: media.url),
              let scene = try? OverlayScene.decode(data)
        else { throw NativeEditorError.incompatibleMedia(media.name) }
        return scene
    }

    static func make(
        overlay: ProjectOverlay,
        media: ProjectMedia,
        scene: OverlayScene,
        renderSize: CGSize,
        compositionDuration: Double
    ) -> CALayer {
        let initialCrop = OverlayKeyTrack.crop(of: overlay, at: 0)
        let shownAspect = OverlayFrame.shownAspect(
            mediaAspect: CompositionBuilder.aspect(of: media),
            crop: initialCrop
        )
        // The canvas measures from the top of the frame and Core Animation
        // from the bottom, so the fitted box is flipped on its way in.
        let box = OverlayFrame.fitted(OverlayFrame.box(overlay, in: renderSize), mediaAspect: shownAspect)
        let container = CALayer()
        container.frame = CGRect(
            x: box.minX,
            y: renderSize.height - box.maxY,
            width: box.width,
            height: box.height
        )

        let placement = initialCrop.mediaPlacement(
            mediaAspect: CompositionBuilder.aspect(of: media), boxAspect: box.width / box.height)
        let fullSize = CGSize(width: box.width * placement.width, height: box.height * placement.height)
        let cropLayer = CALayer()
        cropLayer.frame = CGRect(origin: .zero, size: box.size)
        cropLayer.masksToBounds = true
        container.addSublayer(cropLayer)
        let contentLayer = CALayer()
        contentLayer.frame = CGRect(x: placement.x * box.width,
            y: box.height - placement.y * box.height - fullSize.height,
            width: fullSize.width, height: fullSize.height)
        cropLayer.addSublayer(contentLayer)
        var playbackScene = scene
        let rate = overlay.resolvedPlaybackRate
        playbackScene.duration /= rate
        playbackScene.animations = scene.animations.map { animation in
            var timed = animation
            timed.start /= rate; timed.end /= rate; timed.stagger /= rate
            return timed
        }
        let sceneLayer = SceneLayerBuilder.makeLayer(
            scene: playbackScene, size: fullSize, palette: media.generated?.palette ?? .house,
            assets: FileSceneAssetResolver(sceneFile: media.url),
            mode: .animated(beginTime: AVCoreAnimationBeginTimeAtZero + overlay.timelineStart - overlay.sourceStart / rate))
        contentLayer.addSublayer(sceneLayer)

        // A card with its own background casts the same shadow an image card
        // does. A scene drawn straight over the video, or cut to the whole
        // frame, is part of the picture and gets none. The scene's own corners
        // are its background's, so no radius is imposed from outside.
        if scene.background != nil, !OverlayFrame.isFullFrame(overlay) {
            container.shadowColor = NSColor.black.cgColor
            container.shadowOpacity = 0.28
            container.shadowRadius = 12
            container.shadowOffset = CGSize(width: 0, height: -4)
        }

        if overlay.resolvedRotation != 0 {
            // Core Animation measures its angles the other way round from the
            // canvas, which counts clockwise, because its frame has its origin
            // at the bottom.
            container.transform = CATransform3DMakeRotation(-overlay.rotationRadians, 0, 0, 1)
        }

        applyVisibility(
            to: container,
            start: overlay.timelineStart,
            layerDuration: overlay.duration,
            compositionDuration: compositionDuration
        )
        applyMotion(
            to: container,
            overlay: overlay,
            content: contentLayer,
            baseContentSize: fullSize,
            mediaAspect: CompositionBuilder.aspect(of: media),
            baseBox: box,
            renderSize: renderSize,
            compositionDuration: compositionDuration
        )
        return container
    }

    /// The same opacity window `CompositionBuilder.applyVisibility` gives an
    /// image, repeated here rather than opened up: it is fifteen lines, and
    /// the export builder's private surface stays private.
    private static func applyVisibility(
        to layer: CALayer,
        start: Double,
        layerDuration: Double,
        compositionDuration: Double
    ) {
        layer.opacity = 0
        let track = LayerVisibilityKeyframes.make(
            start: start,
            layerDuration: layerDuration,
            compositionDuration: compositionDuration
        )
        let animation = CAKeyframeAnimation(keyPath: "opacity")
        animation.values = track.values
        animation.keyTimes = track.keyTimes.map(NSNumber.init(value:))
        animation.duration = compositionDuration
        animation.beginTime = AVCoreAnimationBeginTimeAtZero
        animation.isRemovedOnCompletion = false
        animation.fillMode = .both
        layer.add(animation, forKey: "timelineVisibility")
    }

    /// Moves a keyed scene along its boxes.
    ///
    /// An image is moved with `position` and `bounds` keyframes, and its bitmap
    /// stretches to fill the new bounds. A scene's sublayers are laid out in
    /// points and would not follow a bounds change, so the whole card is scaled
    /// as one thing instead: `transform` carries the size and `position` the
    /// place, and every layer inside comes along.
    private static func applyMotion(
        to layer: CALayer,
        overlay: ProjectOverlay,
        content: CALayer,
        baseContentSize: CGSize,
        mediaAspect: Double,
        baseBox: CGRect,
        renderSize: CGSize,
        compositionDuration: Double
    ) {
        guard OverlayKeyTrack.isKeyed(overlay), compositionDuration > 0,
              baseBox.width > 0, baseBox.height > 0 else { return }
        let rotation = CATransform3DMakeRotation(-overlay.rotationRadians, 0, 0, 1)
        var positions: [NSValue] = [], transforms: [NSValue] = []
        var contentPositions: [NSValue] = [], contentTransforms: [NSValue] = []
        var times: [NSNumber] = []
        let localStart = max(0, -overlay.timelineStart)
        let localEnd = min(overlay.duration, compositionDuration - overlay.timelineStart)
        guard localEnd > localStart else { return }
        let samples = Set(OverlayKeyTrack.sampleTimes(of: overlay).filter { $0 > localStart && $0 < localEnd } + [localStart, localEnd]).sorted()
        for time in samples {
            let key = OverlayKeyTrack.box(of: overlay, at: time)
            let crop = OverlayKeyTrack.crop(of: overlay, at: time)
            let box = OverlayFrame.fitted(
                CGRect(x: key.x * renderSize.width, y: key.y * renderSize.height,
                       width: key.width * renderSize.width, height: key.height * renderSize.height),
                mediaAspect: OverlayFrame.shownAspect(mediaAspect: mediaAspect, crop: crop))
            positions.append(NSValue(point: CGPoint(x: box.midX, y: renderSize.height - box.midY)))
            let scale = CATransform3DMakeScale(box.width / baseBox.width, box.height / baseBox.height, 1)
            transforms.append(NSValue(caTransform3D: CATransform3DConcat(scale, rotation)))
            let placement = crop.mediaPlacement(mediaAspect: mediaAspect, boxAspect: box.width / box.height)
            let full = CGSize(width: baseBox.width * placement.width, height: baseBox.height * placement.height)
            contentPositions.append(NSValue(point: CGPoint(x: placement.x * baseBox.width + full.width / 2,
                y: baseBox.height - placement.y * baseBox.height - full.height / 2)))
            contentTransforms.append(NSValue(caTransform3D: CATransform3DMakeScale(
                full.width / baseContentSize.width, full.height / baseContentSize.height, 1)))
            times.append(NSNumber(value: (overlay.timelineStart + time) / compositionDuration))
        }
        for (target, keyPath, values) in [(layer, "position", positions), (layer, "transform", transforms),
                                        (content, "position", contentPositions), (content, "transform", contentTransforms)] {
            let animation = CAKeyframeAnimation(keyPath: keyPath)
            animation.values = values
            animation.keyTimes = times
            animation.calculationMode = .linear
            animation.duration = compositionDuration
            animation.beginTime = AVCoreAnimationBeginTimeAtZero
            animation.isRemovedOnCompletion = false
            animation.fillMode = .both
            target.add(animation, forKey: "overlayMotion.\(keyPath)")
        }
    }
}
