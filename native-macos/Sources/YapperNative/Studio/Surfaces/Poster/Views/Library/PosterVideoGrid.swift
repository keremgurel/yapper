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

    private let columns = [GridItem(.adaptive(minimum: 168, maximum: 240), spacing: 16, alignment: .top)]

    var body: some View {
        if case let .platform(platform) = source, !connected, !loading {
            PosterConnectTile(platform: platform) { onConnect(platform) }
        } else if loading && videos.isEmpty {
            skeleton
        } else if source != .yapper && videos.isEmpty {
            NativeEmptyState(
                systemImage: "film",
                title: "Nothing posted here yet",
                message: "Videos you publish to this channel will appear here, ready to send elsewhere."
            )
        } else {
            LazyVGrid(columns: columns, alignment: .leading, spacing: 16) {
                if source == .yapper {
                    PosterUploadTile(upload: upload)
                }
                ForEach(videos) { video in
                    PosterVideoCard(video: video, importing: bench.importingID == video.id) {
                        Task { await bench.open(video) }
                    }
                }
            }
        }
    }

    private var skeleton: some View {
        LazyVGrid(columns: columns, alignment: .leading, spacing: 16) {
            ForEach(0..<6, id: \.self) { _ in
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(Color.studioFaintFill)
                    .aspectRatio(9 / 13, contentMode: .fit)
            }
        }
    }
}

/// Where a new export goes. Same shape as a card, sunken rather than
/// bordered so it reads as a place to put something.
struct PosterUploadTile: View {
    @ObservedObject var upload: PosterUploadStore

    var body: some View {
        Button { upload.choose() } label: {
            VStack(spacing: 10) {
                Group {
                    if upload.busy { ProgressView().controlSize(.small) } else { Image(systemName: "square.and.arrow.up") }
                }
                .frame(width: 40, height: 40)
                .background(Circle().fill(Color.panelBackground))
                Text(title).font(.system(size: 13, weight: .semibold))
                Text("MP4 or MOV. Or drop it anywhere on this page.")
                    .font(.system(size: 11)).foregroundStyle(.secondary).multilineTextAlignment(.center)
            }
            .padding(16)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .aspectRatio(9 / 13, contentMode: .fit)
            .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Color.studioInputBackground))
        }
        .buttonStyle(.studioPlain)
        .disabled(upload.busy)
    }

    private var title: String {
        switch upload.phase {
        case .uploading: "Uploading \(Int(upload.progress * 100))%"
        case .preparing: "Reading the video"
        default: "Add a finished video"
        }
    }
}

/// A channel that is not linked yet, where its videos would be.
struct PosterConnectTile: View {
    let platform: PublishPlatform
    let onConnect: () -> Void

    var body: some View {
        NativeEmptyState(
            systemImage: platform.symbol,
            title: "Connect \(platform.label) to repost from it",
            message: "Your published videos show up here, and \(platform.label) becomes a place this Poster can send to."
        ) {
            Button("Connect \(platform.label)", action: onConnect)
                .buttonStyle(EditorSecondaryButtonStyle(size: .small))
                .padding(.top, 4)
        }
        .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Color.studioInputBackground))
    }
}
