import AppKit
import SwiftUI

/// Scrubs the same animation tree used by export; only the clock changes
/// during playback, not the scene or its cached counter faces.
struct SceneCanvasPreview: View {
    let media: ProjectMedia
    let overlay: ProjectOverlay
    let size: CGSize
    @ObservedObject var clock: PlaybackClock

    var body: some View {
        SceneLayerHost(media: media, crop: overlay.resolvedCrop, size: size,
                       time: max(0, clock.currentTime - overlay.timelineStart + overlay.sourceStart))
    }
}

private struct SceneLayerHost: NSViewRepresentable {
    let media: ProjectMedia
    let crop: OverlayCrop
    let size: CGSize
    let time: Double

    final class Host: NSView {
        var media: ProjectMedia?
        var crop: OverlayCrop?
        var sceneSize: CGSize = .zero
        var sceneLayer: CALayer?
        var duration: Double = 0
    }

    func makeNSView(context: Context) -> Host {
        let view = Host()
        view.wantsLayer = true
        view.layer?.masksToBounds = true
        return view
    }

    func updateNSView(_ view: Host, context: Context) {
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        defer { CATransaction.commit() }
        if view.media != media || view.sceneSize != size || view.crop != crop {
            view.layer?.sublayers = nil
            view.media = media
            view.sceneSize = size
            view.crop = crop
            guard let scene = SceneFileCache.shared.scene(at: media.url), size.height > 0 else { return }
            let placement = crop.mediaPlacement(mediaAspect: CompositionBuilder.aspect(of: media), boxAspect: size.width / size.height)
            let full = CGSize(width: size.width * placement.width, height: size.height * placement.height)
            let layer = SceneLayerBuilder.makeLayer(scene: scene, size: full,
                palette: media.generated?.palette ?? .house,
                assets: FileSceneAssetResolver(sceneFile: media.url), mode: .animated(beginTime: 1e-9))
            layer.frame.origin = CGPoint(x: placement.x * size.width,
                y: size.height - placement.y * size.height - full.height)
            layer.speed = 0
            view.duration = scene.duration
            view.sceneLayer = layer
            view.layer?.addSublayer(layer)
        }
        view.sceneLayer?.timeOffset = min(view.duration, max(0, time))
    }
}
