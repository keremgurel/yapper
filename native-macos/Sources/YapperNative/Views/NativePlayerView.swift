@preconcurrency import AVFoundation
import AppKit
import SwiftUI

final class PlayerSurfaceView: NSView {
    override func makeBackingLayer() -> CALayer {
        let layer = AVPlayerLayer()
        layer.videoGravity = .resizeAspect
        layer.backgroundColor = NSColor.black.cgColor
        layer.actions = [
            "bounds": NSNull(),
            "position": NSNull(),
            "sublayers": NSNull(),
            "contents": NSNull(),
        ]
        return layer
    }

    var playerLayer: AVPlayerLayer { layer as! AVPlayerLayer }

    override func layout() {
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        playerLayer.frame = bounds
        CATransaction.commit()
        super.layout()
    }
}

struct NativePlayerView: NSViewRepresentable {
    let player: AVPlayer

    func makeNSView(context: Context) -> PlayerSurfaceView {
        let view = PlayerSurfaceView()
        view.wantsLayer = true
        view.playerLayer.player = player
        return view
    }

    func updateNSView(_ nsView: PlayerSurfaceView, context: Context) {
        if nsView.playerLayer.player !== player {
            nsView.playerLayer.player = player
        }
    }
}
