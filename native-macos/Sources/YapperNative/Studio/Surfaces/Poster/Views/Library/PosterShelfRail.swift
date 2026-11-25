import SwiftUI

/// A source's recent videos in one horizontal row. A trackpad scrolls it
/// directly; a mouse gets a button at each end that has more to show.
struct PosterShelfRail: View {
    let videos: [PosterVideo]
    @ObservedObject var bench: PosterBench
    var onTrashProject: ((ProjectListing) -> Void)? = nil
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var leading: String?
    @State private var width: CGFloat = 0

    /// Enough to choose from without loading a channel's whole history.
    private static let limit = 24
    private let tileWidth: CGFloat = 124
    private let spacing: CGFloat = 12

    private var shown: [PosterVideo] { Array(videos.prefix(Self.limit)) }
    private var visible: Int { max(1, Int((width + spacing) / (tileWidth + spacing))) }
    private var index: Int { shown.firstIndex { $0.id == leading } ?? 0 }

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            LazyHStack(alignment: .top, spacing: spacing) {
                ForEach(shown) { video in
                    PosterShelfTile(video: video, importing: bench.importingID == video.id, onTrashProject: onTrashProject) {
                        Task { await bench.open(video) }
                    }
                    .frame(width: tileWidth)
                }
            }
            .scrollTargetLayout()
        }
        .scrollPosition(id: $leading, anchor: .leading)
        .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { width = $0 }
        .overlay(alignment: .leading) { if index > 0 { arrow(-1) } }
        .overlay(alignment: .trailing) { if index + visible < shown.count { arrow(1) } }
    }

    private func arrow(_ direction: Int) -> some View {
        Button {
            let target = min(max(index + direction * max(1, visible - 1), 0), shown.count - 1)
            withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.36)) { leading = shown[target].id }
        } label: {
            Image(systemName: direction > 0 ? "chevron.right" : "chevron.left")
                .font(.studioLabelStrong).foregroundStyle(.primary)
                .frame(width: 30, height: 30)
                .background(Circle().fill(Color.raisedBackground))
                .overlay(Circle().strokeBorder(Color.studioLineStrong, lineWidth: 0.5))
                .shadow(color: .black.opacity(0.08), radius: 3, y: 1)
        }
        .buttonStyle(.studioPlain)
        .accessibilityLabel(direction > 0 ? "Show more videos" : "Show earlier videos")
        .offset(x: direction > 0 ? 12 : -12, y: -24)
    }
}
