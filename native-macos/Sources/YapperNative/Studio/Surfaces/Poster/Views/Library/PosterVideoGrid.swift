import SwiftUI

/// The selected source's videos. Yapper's list leads with the upload tile;
/// a channel that is not connected shows the one thing to do about that.
struct PosterVideoGrid: View {
    let source: PosterSource
    let videos: [PosterVideo]
    let loading: Bool
    let connected: Bool
    @ObservedObject var bench: PosterBench
    @ObservedObject var upload: PosterUploadStore
    let onConnect: (PublishPlatform) -> Void
    var onTrashProject: ((ProjectListing) -> Void)? = nil

    var body: some View {
        if case let .platform(platform) = source, !connected {
            PosterConnectTile(platform: platform) { onConnect(platform) }
        } else if loading && videos.isEmpty {
            skeleton
        } else if source == .yapper && videos.isEmpty {
            NativeEmptyState(systemImage: "film", title: "Your edited projects appear here",
                             message: "Save an edit in Editor. Its latest version is automatically ready to prepare in Poster.")
        } else if source != .uploads && videos.isEmpty {
            NativeEmptyState(
                systemImage: "film",
                title: "Nothing posted here yet",
                message: "Videos you publish to this channel will appear here, ready to send elsewhere."
            )
        } else if videos.isEmpty {
            Text("Upload a video or pick a platform to reuse one of your posts.")
                .font(.system(size: 13)).foregroundStyle(.secondary)
        } else {
            LazyVStack(alignment: .leading, spacing: 0) {
                Divider()
                ForEach(videos) { video in
                    PosterVideoCard(video: video, importing: bench.importingID == video.id, onTrashProject: onTrashProject) {
                        Task { await bench.open(video) }
                    }
                    Divider()
                }
            }
        }
    }

    private var skeleton: some View {
        NativeLoadingState(label: "Loading videos")
    }
}

/// A channel that is not linked yet, where its videos would be.
struct PosterConnectTile: View {
    let platform: PublishPlatform
    let onConnect: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Divider()
            HStack(spacing: 16) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Bring over your \(platform.label) videos").font(.nativeSectionTitle)
                    Text("Connect your account to reuse posts and publish new ones.")
                        .font(.system(size: 13)).foregroundStyle(.secondary)
                }
                Spacer()
                Button("Connect \(platform.label)", action: onConnect).buttonStyle(EditorSecondaryButtonStyle())
            }
            .padding(.vertical, 14)
        }
    }
}
