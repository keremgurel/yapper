import SwiftUI

/// The three most-viewed posts across every channel. A card opens the post
/// on its platform; rank is carried by order alone.
struct HomeTopContentSection: View {
    let ranked: [HomeRankedVideo]?
    let unavailable: Bool

    var body: some View {
        NativeSection(title: "Top content", meta: "by views") {
            Button("Open Poster") { StudioNavigation.shared.goTo(.poster) }
                .buttonStyle(EditorGhostButtonStyle(size: .small))
        } content: {
            content
        }
    }

    @ViewBuilder
    private var content: some View {
        if let ranked {
            if unavailable && ranked.isEmpty {
                Text("Channel performance is unavailable. Use Refresh above to try again.")
                    .font(.system(size: 13)).foregroundStyle(.secondary)
            } else if ranked.isEmpty {
                NativeEmptyState(
                    systemImage: "video",
                    title: "No posts to rank yet",
                    message: "Connect a channel and its most-viewed videos land here."
                ) {
                    Button("Connect a channel") { StudioNavigation.shared.goTo(.connections) }
                        .buttonStyle(EditorSecondaryButtonStyle(size: .small))
                }
            } else {
                cards(Array(ranked.prefix(3)))
            }
        } else {
            cards([])
        }
    }

    /// Three equal columns; empty slots draw as skeletons while loading.
    private func cards(_ top: [HomeRankedVideo]) -> some View {
        HStack(alignment: .top, spacing: 12) {
            if top.isEmpty {
                ForEach(0..<3, id: \.self) { _ in
                    RoundedRectangle(cornerRadius: 12).fill(Color.studioFaintFill).frame(height: 176).frame(maxWidth: .infinity)
                }
            } else {
                ForEach(top) { HomeVideoCard(ranked: $0).frame(maxWidth: .infinity) }
                ForEach(top.count..<3, id: \.self) { _ in Color.clear.frame(maxWidth: .infinity, maxHeight: 1) }
            }
        }
    }
}

private struct HomeVideoCard: View {
    let ranked: HomeRankedVideo
    @Environment(\.openURL) private var openURL
    @State private var hovering = false

    var body: some View {
        Button {
            if let url = URL(string: ranked.video.url) { openURL(url) }
        } label: {
            VStack(alignment: .leading, spacing: 0) {
                thumbnail
                VStack(alignment: .leading, spacing: 8) {
                    Text(ranked.video.title.isEmpty ? "Untitled" : ranked.video.title)
                        .font(.system(size: 13, weight: .semibold))
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                        .frame(maxWidth: .infinity, minHeight: 34, alignment: .topLeading)
                    HStack(spacing: 6) {
                        Image(systemName: ranked.platform.symbol).font(.system(size: 11))
                        Text(ranked.platform.label).lineLimit(1)
                        Spacer(minLength: 4)
                        Text("\(HomeNumber.compact(ranked.video.viewCount)) views").monospacedDigit()
                    }
                    .font(.system(size: 12))
                    .foregroundStyle(.secondary)
                }
                .padding(12)
            }
            .background(Color.panelBackground)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .strokeBorder(hovering ? Color.studioLineStrong : Color.studioLine, lineWidth: 1)
            )
        }
        .buttonStyle(.studioPlain)
        .onHover { hovering = $0 }
        .help("Open on \(ranked.platform.label)")
    }

    private var thumbnail: some View {
        Color.studioFaintFill
            .aspectRatio(4 / 3, contentMode: .fit)
            .overlay {
                if let source = ranked.video.thumbnail, let url = URL(string: source) {
                    AsyncImage(url: url) { image in
                        image.resizable().scaledToFill()
                    } placeholder: {
                        Color.clear
                    }
                }
            }
            .clipped()
    }
}
