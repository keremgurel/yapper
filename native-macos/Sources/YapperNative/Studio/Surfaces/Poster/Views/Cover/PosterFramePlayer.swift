import AVKit
import SwiftUI

/// The source video, parked on the picked frame. It plays like any video,
/// and follows the picker whenever a new frame is chosen.
struct PosterFramePlayer: View {
    let url: URL?
    let time: Double
    @State private var player: AVPlayer?

    var body: some View {
        ZStack {
            Rectangle().fill(Color.black)
            if let player {
                VideoPlayer(player: player)
            } else {
                ProgressView().controlSize(.small)
            }
        }
        .aspectRatio(9 / 16, contentMode: .fit)
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        .task(id: url) {
            guard let url else { return }
            let next = AVPlayer(url: url)
            next.isMuted = true
            player = next
            seek()
        }
        .onChange(of: time) { _, _ in seek() }
        .onDisappear { player?.pause() }
    }

    private func seek() {
        guard let player, player.timeControlStatus != .playing else { return }
        player.seek(to: CMTime(seconds: time, preferredTimescale: 60_000), toleranceBefore: .zero, toleranceAfter: .zero)
    }
}

/// A plain player for a signed preview URL, made once per URL.
struct PosterPreviewPlayer: View {
    let url: URL
    @State private var player: AVPlayer?

    var body: some View {
        ZStack {
            Rectangle().fill(Color.black)
            if let player { VideoPlayer(player: player) } else { ProgressView().controlSize(.small) }
        }
        .task(id: url) { player = AVPlayer(url: url) }
        .onDisappear { player?.pause() }
    }
}
