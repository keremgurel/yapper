import SwiftUI

/// The posts themselves. Recent shows the latest four against the typical
/// post ("3.2× usual"), which is what changes week to week; Top is the
/// all-time list.
struct HomePostsRail: View {
    enum Mode: Hashable { case recent, top }

    /// Nil while channel history loads; already sorted by views.
    let ranked: [HomeRankedVideo]?
    let typical: Int
    @State private var mode = Mode.recent

    private var posts: [HomeRankedVideo]? {
        guard let ranked else { return nil }
        return mode == .top ? Array(ranked.prefix(4)) : HomeRanking.latest(ranked)
    }

    var body: some View {
        NativeSection(
            title: "Posts",
            meta: mode == .recent ? "Latest, against your typical post" : "Most viewed"
        ) {
            NativeSegmented(
                options: [.init(value: Mode.recent, label: "Recent"), .init(value: Mode.top, label: "Top")],
                selection: $mode
            )
            Button("Open Poster") { StudioNavigation.shared.goTo(.poster) }
                .buttonStyle(EditorGhostButtonStyle(size: .small))
        } content: {
            content
        }
    }

    @ViewBuilder
    private var content: some View {
        if let posts {
            if posts.isEmpty {
                Text("Your posts and their views show up here after your first publish.")
                    .font(.system(size: 13))
                    .foregroundStyle(.secondary)
                    .padding(.vertical, 8)
            } else {
                row(posts.map(Optional.some))
            }
        } else {
            row([nil, nil, nil, nil])
        }
    }

    /// Four equal columns; empty slots keep the grid's rhythm.
    private func row(_ posts: [HomeRankedVideo?]) -> some View {
        HStack(alignment: .top, spacing: 12) {
            ForEach(0..<4, id: \.self) { index in
                Group {
                    if index < posts.count, let post = posts[index] {
                        HomePostCard(
                            post: post,
                            times: mode == .recent ? HomeChannelMath.versusUsual(post.video.viewCount, typical: typical) : nil
                        )
                    } else if index < posts.count {
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .fill(Color.studioFaintFill)
                            .aspectRatio(3 / 4, contentMode: .fit)
                    } else {
                        Color.clear.frame(height: 1)
                    }
                }
                .frame(maxWidth: .infinity)
            }
        }
    }
}

/// One post: the cover with its views, the title, and how it did against
/// the typical post. Opens the post on its platform.
private struct HomePostCard: View {
    let post: HomeRankedVideo
    let times: Double?
    @Environment(\.openURL) private var openURL
    @State private var hovering = false

    var body: some View {
        Button {
            if let url = URL(string: post.video.url) { openURL(url) }
        } label: {
            VStack(alignment: .leading, spacing: 8) {
                cover
                HStack(alignment: .top, spacing: 8) {
                    Text(post.video.displayTitle)
                        .font(.system(size: 13, weight: .medium))
                        .underline(hovering)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    if let times {
                        NativeChip(text: "\(HomeNumber.multiplier(times)) usual", tone: times >= 1.5 ? .green : .neutral)
                    }
                }
            }
        }
        .buttonStyle(.studioPlain)
        .onHover { hovering = $0 }
        .clickableCursor()
        .help("Open on \(post.platform.label)")
    }

    private var cover: some View {
        Color.studioFaintFill
            .aspectRatio(3 / 4, contentMode: .fit)
            .overlay {
                RemoteThumbnail(url: post.video.thumbnail.flatMap(URL.init(string:)))
            }
            .overlay(alignment: .bottomLeading) {
                HStack(spacing: 6) {
                    PublishPlatformGlyph(platform: post.platform, size: 12)
                    Text(HomeNumber.compact(post.video.viewCount))
                        .font(.system(size: 12, weight: .semibold, design: .monospaced))
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(Capsule().fill(.black.opacity(0.6)))
                .padding(8)
            }
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}
