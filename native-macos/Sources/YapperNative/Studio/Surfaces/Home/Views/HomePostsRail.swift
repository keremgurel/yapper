import SwiftUI

struct HomePostsRail: View {
    enum Mode: Hashable { case latest, top }
    let performance: HomeRecentPerformance?
    @State private var mode = Mode.latest

    var body: some View {
        NativeSection(title: "Views by video", meta: "Published in the last 30 days") {
            NativeSegmented(options: [.init(value: Mode.latest, label: "Latest"), .init(value: Mode.top, label: "Most viewed")], selection: $mode)
        } content: {
            if let performance {
                let groups = mode == .top ? performance.groups : performance.groups.sorted { $0.publishedAt > $1.publishedAt }
                let posts = Array(groups.prefix(8))
                if posts.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Your next video starts the chart").font(.system(size: 14, weight: .medium))
                        Text("No videos were found in the last 30 days. Older posts are still in Poster.").font(.system(size: 13)).foregroundStyle(.secondary)
                    }.padding(.vertical, 32)
                } else {
                    VStack(alignment: .leading, spacing: 4) {
                        HStack(spacing: 16) {
                            ForEach(performance.channels.filter { $0.posts > 0 }) { channel in
                                HStack(spacing: 6) {
                                    Circle().fill(HomeChartColor.color(channel.platform)).frame(width: 8, height: 8)
                                    Text(channel.platform.label).font(.system(size: 12)).foregroundStyle(.secondary)
                                }
                            }
                        }.padding(.bottom, 4)
                        ForEach(posts) { group in
                            HomeVideoBar(group: group, maximum: posts.map(\.views).max() ?? 0)
                            if group.id != posts.last?.id { Divider() }
                        }
                        Text("\(mode == .latest ? "Latest" : "Most-viewed") \(posts.count) of \(groups.count) unique videos. Current lifetime views, cross-posts combined.")
                            .font(.system(size: 12)).foregroundStyle(.secondary).padding(.top, 12)
                    }
                }
            } else {
                NativeLoadingState(label: "Loading video performance…")
            }
        }
    }
}

private struct HomeVideoBar: View {
    let group: HomeVideoGroup
    let maximum: Int
    @State private var expanded = false
    @Environment(\.openURL) private var openURL
    private var date: String { IdeaDates.parse(group.publishedAt)?.formatted(.dateTime.month(.abbreviated).day()) ?? "" }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Button { expanded.toggle() } label: {
                HStack(spacing: 12) {
                    RemoteThumbnail(url: group.primary.video.thumbnail.flatMap(URL.init(string:)))
                        .frame(width: 40, height: 56).background(Color.studioFaintFill).clipShape(RoundedRectangle(cornerRadius: 6))
                    VStack(alignment: .leading, spacing: 8) {
                        HStack(alignment: .firstTextBaseline, spacing: 12) {
                            Text(group.primary.video.displayTitle).font(.system(size: 13, weight: .medium)).lineLimit(1).frame(maxWidth: .infinity, alignment: .leading)
                            Text(HomeNumber.compact(group.views)).font(.system(size: 14, weight: .semibold)).monospacedDigit()
                        }
                        GeometryReader { geometry in
                            ZStack(alignment: .leading) {
                                Color.studioFaintFill
                                HStack(spacing: 0) {
                                    ForEach(group.posts) { post in
                                        HomeChartColor.color(post.platform).frame(width: maximum > 0 ? geometry.size.width * CGFloat(post.video.viewCount) / CGFloat(maximum) : 0)
                                    }
                                }
                            }.clipShape(RoundedRectangle(cornerRadius: 3))
                        }.frame(height: 12).accessibilityHidden(true)
                        HStack {
                            Text("\(date) · \(group.posts.count > 1 ? "\(group.posts.count) channels" : group.primary.platform.label)")
                            Spacer()
                            Text(expanded ? "Hide details" : "Details")
                        }.font(.system(size: 12)).foregroundStyle(.secondary)
                    }
                }.padding(.vertical, 12).contentShape(Rectangle())
            }.buttonStyle(.studioPlain).accessibilityLabel("\(group.primary.video.displayTitle), \(group.views) views, \(expanded ? "hide" : "show") details")
            if expanded {
                VStack(alignment: .leading, spacing: 8) {
                    Text(group.primary.video.displayTitle).font(.system(size: 14, weight: .medium)).fixedSize(horizontal: false, vertical: true)
                    ForEach(group.posts) { post in
                        Button {
                            if let url = URL(string: post.video.url) { openURL(url) }
                        } label: {
                            HStack(spacing: 8) {
                                PublishPlatformGlyph(platform: post.platform, size: 14)
                                Text("\(post.platform.label)  \(post.video.viewCount.formatted()) views").font(.system(size: 12))
                            }.padding(.vertical, 4)
                        }.buttonStyle(.studioPlain).help("Open on \(post.platform.label)")
                    }
                }.padding(12).frame(maxWidth: .infinity, alignment: .leading).background(Color.studioFaintFill, in: RoundedRectangle(cornerRadius: 8))
            }
        }
    }
}

enum HomeChartColor {
    static func color(_ platform: PublishPlatform) -> Color {
        let light: UInt32
        let dark: UInt32
        switch platform {
        case .youtube: (light, dark) = (0xD92E26, 0xFF4E45)
        case .instagram: (light, dark) = (0xB43278, 0xF06CAE)
        case .tiktok: (light, dark) = (0x087F7A, 0x42E8E0)
        case .facebook: (light, dark) = (0x1664D8, 0x6AA8FF)
        }
        return Color(nsColor: NSColor(name: nil) { appearance in
            NSColor(hex: appearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua ? dark : light)
        })
    }
}
