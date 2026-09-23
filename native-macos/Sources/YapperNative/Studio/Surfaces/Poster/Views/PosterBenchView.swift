import SwiftUI

/// One video open: the source's videos as a rail, the thumbnail in the
/// middle, and the destinations with the one publish button on the right.
/// Stacks on narrow windows.
struct PosterBenchView: View {
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
            if width >= 1180 {
                HStack(alignment: .top, spacing: 28) {
                    rail.frame(width: 240)
                    cover.frame(maxWidth: .infinity)
                    destinations.frame(width: 380)
                }
            } else {
                VStack(alignment: .leading, spacing: 28) {
                    cover
                    destinations
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

    private var cover: some View {
        NativeSection(title: "Thumbnail", meta: video.title) {
            PosterCoverStudio(video: video, drafts: drafts, framePending: $framePending)
                .id(video.id)
        }
    }

    private var destinations: some View {
        NativeSection(title: "Send to") {
            PosterDestinationColumn(
                video: video, framePending: framePending, drafts: drafts, connections: connections,
                generator: .shared, prep: .shared
            )
        }
    }
}
