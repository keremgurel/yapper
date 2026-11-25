import SwiftUI

/// One video on a source shelf, portrait like the video. The whole tile
/// opens it; a channel post Yapper has no file for is shown but disabled.
struct PosterShelfTile: View {
    @ObservedObject private var sync = PosterProjectSync.shared
    let video: PosterVideo
    let importing: Bool
    var onTrashProject: ((ProjectListing) -> Void)? = nil
    let onOpen: () -> Void
    @State private var hovering = false

    private var shape: RoundedRectangle { RoundedRectangle(cornerRadius: StudioRadius.card, style: .continuous) }

    var body: some View {
        Button(action: onOpen) {
            VStack(alignment: .leading, spacing: 6) {
                PosterVideoStill(video: video, iconSize: 16)
                    .aspectRatio(9 / 16, contentMode: .fit)
                    .clipShape(shape)
                    .overlay {
                        shape.strokeBorder(hovering && video.canOpen ? Color.studioAccent : Color.studioLine,
                                           lineWidth: hovering && video.canOpen ? 2 : 0.5)
                    }
                    .overlay { if importing { ProgressView().controlSize(.small) } }
                Text(video.title).font(.studioLabelStrong)
                    .lineLimit(2).multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
                meta
            }
            .contentShape(Rectangle())
            .opacity(video.canOpen ? 1 : 0.5)
        }
        .buttonStyle(.studioPlain)
        .disabled(!video.canOpen || importing)
        .onHover { hovering = $0 }
        .help(video.canOpen ? video.title : "Only videos posted through Yapper can be reposted from here")
        .accessibilityLabel(video.needsOriginal ? "Attach original video for \(video.title)" : "Use \(video.title)")
        .overlay(alignment: .topTrailing) {
            if PosterRemoveUploadButton.canRemove(video) { PosterRemoveUploadButton(video: video).padding(6) }
        }
        .contextMenu {
            if case let .project(listing) = video.origin, let onTrashProject {
                Button("Show in Finder") { ProjectPanels.revealInFinder(listing.package) }
                Button("Move project to Trash", role: .destructive) { onTrashProject(listing) }
            }
        }
    }

    @ViewBuilder
    private var meta: some View {
        switch video.origin {
        case let .project(listing):
            if let status = sync.status[listing.summary.id] {
                Text(status).font(.studioCaption).foregroundStyle(.secondary).lineLimit(1)
            } else if sync.errors[listing.summary.id] != nil {
                Text("Preview needs attention").font(.studioCaption).foregroundStyle(NativeChip.Tone.yellow.color)
            } else {
                Text("\(Int(listing.summary.duration))s").font(.studioCaption.monospacedDigit()).foregroundStyle(.secondary)
            }
        case .file:
            Text("Uploading…").font(.studioCaption).foregroundStyle(.secondary)
        case .yapper:
            EmptyView()
        case let .platform(_, _, _, _, views, publishedAt, _, _, _):
            if video.needsOriginal {
                Text("Attach original").font(.studioCaption).foregroundStyle(.secondary)
            } else {
                HStack(spacing: 6) {
                    Text(PosterFormat.day(publishedAt))
                    Spacer(minLength: 0)
                    Label(PosterFormat.views(views), systemImage: "eye").labelStyle(.titleAndIcon)
                        .monospacedDigit()
                }
                .font(.studioCaption).foregroundStyle(.secondary)
            }
        }
    }
}
