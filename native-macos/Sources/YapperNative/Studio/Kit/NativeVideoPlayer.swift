import AVKit
import SwiftUI

/// AppKit's player view with inline controls. SwiftUI's `VideoPlayer` aborts
/// on first use in this SwiftPM-built app (AVKit's SwiftUI overlay cannot
/// resolve its class metadata), so every player goes through this instead.
struct NativeVideoPlayer: NSViewRepresentable {
    let player: AVPlayer?

    func makeNSView(context: Context) -> AVPlayerView {
        let view = AVPlayerView()
        view.controlsStyle = .inline
        view.videoGravity = .resizeAspect
        view.player = player
        return view
    }

    func updateNSView(_ view: AVPlayerView, context: Context) {
        if view.player !== player { view.player = player }
    }
}
