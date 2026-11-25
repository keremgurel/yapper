import SwiftUI

/// Recent videos and the selected video's next action, without opening the composer.
struct PosterVideoBrowser: View {
    let videos: [PosterVideo]
    let source: PosterSource
    let query: String
    @Binding var selectedID: String?
    let onOpen: (PosterVideo) -> Void
    let onTrashProject: (ProjectListing) -> Void

    private static let pageSize = 12
    @State private var visibleCount = PosterVideoBrowser.pageSize
    @State private var wide = true

    private var selected: PosterVideo? {
        videos.first { $0.id == selectedID } ?? videos.first
    }

    var body: some View {
        Group {
            if wide {
                HStack(alignment: .top, spacing: 18) {
                    rows
                    if let selected {
                        preview(selected).frame(width: 236)
                    }
                }
            } else {
                rows
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .onGeometryChange(for: Bool.self) { $0.size.width >= 580 } action: { wide = $0 }
        .onChange(of: source) { _, _ in visibleCount = Self.pageSize }
        .onChange(of: query) { _, _ in visibleCount = Self.pageSize }
    }

    private var rows: some View {
        let active = selected
        let selectedIndex = videos.firstIndex { $0.id == active?.id } ?? 0
        let limit = max(visibleCount, selectedIndex + 1)
        return LazyVStack(alignment: .leading, spacing: 3) {
            ForEach(videos.prefix(limit)) { video in
                PosterVideoCard(video: video, selected: video.id == active?.id, onTrashProject: onTrashProject) {
                    selectedID = video.id
                }
                if !wide, video.id == active?.id {
                    preview(video)
                        .padding(.bottom, 6)
                }
            }
            if videos.count > limit {
                Button("Show more") { visibleCount = limit + Self.pageSize }
                    .buttonStyle(EditorSecondaryButtonStyle(size: .small))
                    .padding(.top, 8)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func preview(_ video: PosterVideo) -> some View {
        let shape = RoundedRectangle(cornerRadius: StudioRadius.panel)
        return Group {
            if wide {
                VStack(alignment: .leading, spacing: 12) {
                    still(video, height: 176)
                        .frame(maxWidth: .infinity)
                        .background(Color.studioInputBackground, in: shape)
                    previewDetails(video)
                }
            } else {
                HStack(alignment: .center, spacing: 12) {
                    still(video, height: 76)
                    previewDetails(video)
                }
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.panelBackground, in: shape)
        .overlay(shape.strokeBorder(Color.studioLine))
    }

    private func still(_ video: PosterVideo, height: CGFloat) -> some View {
        PosterVideoStill(video: video)
            .id(video.id)
            .frame(width: height * 9 / 16, height: height)
            .clipShape(RoundedRectangle(cornerRadius: StudioRadius.field))
            .accessibilityHidden(true)
    }

    private func previewDetails(_ video: PosterVideo) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(video.title).font(.studioBodyStrong)
                .lineLimit(3)
                .help(video.title)
            Text(video.source.label).font(.studioLabel).foregroundStyle(.secondary)
            if video.canOpen {
                Button(video.needsOriginal ? "Attach original" : "Use video") { onOpen(video) }
                    .buttonStyle(EditorPrimaryButtonStyle(size: .small))
                    .padding(.top, 4)
            } else {
                Text("The video file isn’t available to reuse.").font(.studioLabel).foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
