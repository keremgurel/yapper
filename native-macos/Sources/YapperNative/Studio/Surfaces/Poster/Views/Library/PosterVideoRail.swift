import SwiftUI

/// Once a video is open, the source's videos shrink to rows beside the
/// work: the open one is marked, any other is one click away.
struct PosterVideoRail: View {
    let source: PosterSource
    let videos: [PosterVideo]
    let activeID: String
    @ObservedObject var bench: PosterBench
    @ObservedObject var upload: PosterUploadStore

    var body: some View {
        VStack(spacing: 0) {
            if source == .yapper {
                Button { upload.choose() } label: {
                    HStack(spacing: 10) {
                        Image(systemName: "plus").font(.system(size: 12))
                            .frame(width: 24, height: 36)
                            .background(RoundedRectangle(cornerRadius: 6).fill(Color.studioInputBackground))
                        Text("Add a finished video").font(.system(size: 13, weight: .medium)).foregroundStyle(.secondary)
                        Spacer(minLength: 0)
                    }
                    .padding(.horizontal, 12).padding(.vertical, 8)
                }
                .buttonStyle(.studioPlain)
                .disabled(upload.busy)
                divider
            }
            ForEach(Array(videos.enumerated()), id: \.element.id) { index, video in
                if index > 0 { divider }
                row(video)
            }
        }
        .background(NativeCardBackground(radius: 12))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    private var divider: some View { Rectangle().fill(Color.studioLine).frame(height: 1) }

    private func row(_ video: PosterVideo) -> some View {
        let active = video.id == activeID
        return Button { Task { await bench.open(video) } } label: {
            HStack(spacing: 10) {
                PosterVideoStill(video: video, iconSize: 11)
                    .frame(width: 24, height: 36)
                    .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
                    .overlay {
                        if bench.importingID == video.id { ProgressView().controlSize(.mini) }
                    }
                Text(video.title)
                    .font(.system(size: 13, weight: active ? .semibold : .medium))
                    .lineLimit(1)
                Spacer(minLength: 0)
                if case let .yapper(_, _, status, _, _) = video.origin {
                    NativeChip(text: status.capitalized, tone: PosterFormat.statusTone(status))
                }
            }
            .padding(.horizontal, 12).padding(.vertical, 8)
            .background(active ? Color.studioSelectedFill : Color.clear)
            .opacity(video.canOpen ? 1 : 0.5)
        }
        .buttonStyle(.studioPlain)
        .disabled(!video.canOpen)
    }
}
