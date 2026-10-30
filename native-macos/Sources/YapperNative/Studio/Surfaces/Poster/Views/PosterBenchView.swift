import SwiftUI

/// One video open: the source's videos as a rail, the thumbnail in the
/// middle, and the destinations with the one publish button on the right.
/// The column is rebuilt per video, so publish settings never carry over.
/// Stacks on narrow windows.
struct PosterBenchView: View {
    var availableHeight: CGFloat = 540
    let video: PosterVideo
    let source: PosterSource
    let videos: [PosterVideo]
    @ObservedObject var bench: PosterBench
    @ObservedObject var upload: PosterUploadStore
    @ObservedObject var drafts: PosterDraftStore
    @ObservedObject var connections: PosterConnectionStore
    @State private var framePending = false
    @State private var width: CGFloat = 1200

    var body: some View {
        Group {
            if width >= 760 {
                HStack(alignment: .top, spacing: 28) {
                    if width >= 1180 { rail.frame(width: 200) }
                    ScrollView { cover }.frame(maxWidth: .infinity).frame(height: availableHeight)
                    destinations.frame(width: min(420, width * 0.48), height: availableHeight)
                }
            } else {
                VStack(alignment: .leading, spacing: 28) {
                    cover
                    destinations.frame(height: availableHeight)
                    rail
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .topLeading)
        .onGeometryChange(for: CGFloat.self, of: { $0.size.width }, action: { width = $0 })
    }

    private var rail: some View {
        NativeSection(title: "Videos", meta: String(videos.count)) {
            Button("All videos", systemImage: "square.grid.2x2") { bench.close() }
                .buttonStyle(EditorGhostButtonStyle(size: .small))
        } content: {
            PosterVideoRail(source: source, videos: videos, activeID: video.id, bench: bench, upload: upload)
        }
    }

    /// The thumbnail tools, or the attach step for a post with no file yet.
    /// A channel title can be a whole caption, so a long one folds away.
    private var cover: some View {
        let long = video.title.count > 120
        return NativeSection(title: video.needsOriginal ? "Attach original video" : "Thumbnail", meta: long ? nil : video.title) {
            VStack(alignment: .leading, spacing: 12) {
                if long {
                    PosterDisclosure(title: "View original post title") {
                        Text(video.title).font(.system(size: 13)).textSelection(.enabled)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                if video.needsOriginal {
                    PosterAttachOriginal(video: video, upload: upload)
                } else {
                    PosterCoverStudio(video: video, drafts: drafts, framePending: $framePending)
                        .id(video.id)
                }
            }
        }
    }

    private var destinations: some View {
        NativeSection(title: "Send to") {
            PosterDestinationColumn(
                video: video, framePending: framePending, drafts: drafts, connections: connections,
                generator: .shared, prep: .shared
            )
            .id(video.id)
        }
    }
}
