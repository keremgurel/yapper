import SwiftUI

/// A connected channel's recent posts, from the same cached list Poster
/// already used per channel. Only connected channels are asked for videos.
struct PosterChannelShelf: View {
    let platform: PublishPlatform
    @ObservedObject var channels: PosterChannelStore
    @ObservedObject var connections: PosterConnectionStore
    @ObservedObject var bench: PosterBench

    var body: some View {
        PosterShelf(title: platform.label) {
            PublishPlatformGlyph(platform: platform, size: 14)
        } content: {
            content
        }
    }

    @ViewBuilder
    private var content: some View {
        let label = platform.label
        if connections.response == nil && !connections.failed {
            PosterShelfSkeleton()
        } else if !connections.connected.contains(platform) {
            connectNotice
        } else if channels.failed.contains(platform) {
            PosterShelfNotice(message: "Your \(label) posts couldn’t be loaded.") {
                Button("Try again") { Task { await channels.refresh(platform, force: true) } }
                    .buttonStyle(EditorSecondaryButtonStyle(size: .small))
            }
        } else if channels.loading(platform) {
            PosterShelfSkeleton()
        } else if !channels.connected(platform) {
            connectNotice
        } else if channels.videos(for: platform).isEmpty {
            PosterShelfNotice(message: "Nothing posted on \(label) yet. New posts show up here.")
        } else {
            PosterShelfRail(videos: channels.videos(for: platform), bench: bench)
        }
    }

    private var connectNotice: some View {
        PosterShelfNotice(message: "Connect \(platform.label) to pick from your recent posts.") {
            Button("Connect \(platform.label)") { connections.connect(platform) }
                .buttonStyle(EditorSecondaryButtonStyle(size: .small))
        }
    }
}
