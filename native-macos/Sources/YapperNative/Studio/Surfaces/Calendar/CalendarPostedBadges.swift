import SwiftUI

/// A day's already-published posts, under its planned ones. A daily poster's
/// month would otherwise bury the planned chips, so each day shows a few and
/// folds the rest into a count.
struct CalendarPostedList: View {
    let groups: [CalendarPostedGroup]
    let dense: Bool

    private var cap: Int { dense ? 2 : 6 }

    var body: some View {
        if !groups.isEmpty {
            VStack(alignment: .leading, spacing: 4) {
                ForEach(groups.prefix(cap)) { group in
                    if dense { CalendarPostedPill(group: group) } else { CalendarPostedCard(group: group) }
                }
                if groups.count > cap {
                    Text("+\(groups.count - cap) posted")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 4)
                }
            }
        }
    }
}

/// Something that already went out, in the month grid: a pill with the
/// platforms it went to and its views. Quieter than a planned chip (no
/// surface, hairline border) because it is history, not something to act
/// on, and it cannot be dragged. Opens the most viewed copy.
private struct CalendarPostedPill: View {
    let group: CalendarPostedGroup
    @Environment(\.openURL) private var openURL
    @State private var hovering = false

    var body: some View {
        Button {
            if let url = URL(string: group.posts.first?.video.url ?? "") { openURL(url) }
        } label: {
            HStack(spacing: 4) {
                CalendarPlatformStack(group: group)
                Text(group.title.isEmpty ? "Untitled" : group.title)
                    .font(.system(size: 11, weight: .semibold))
                    .lineLimit(1)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Text(HomeNumber.compact(group.views))
                    .font(.system(size: 11, weight: .bold).monospacedDigit())
                    .padding(.trailing, 2)
            }
            .foregroundStyle(hovering ? Color.primary : Color.secondary)
            .padding(.horizontal, 4)
            .padding(.vertical, 2)
            .background(Capsule().fill(hovering ? Color.studioFaintFill : Color.clear))
            .overlay(Capsule().strokeBorder(Color.primary.opacity(0.15), lineWidth: 1))
        }
        .buttonStyle(.studioPlain)
        .onHover { hovering = $0 }
        .clickableCursor()
        .help(CalendarPostedCopy.describe(group))
    }
}

/// The same post in the week view, where a column has room: its cover,
/// title, and one badge per platform with that platform's own views, each
/// opening that copy.
private struct CalendarPostedCard: View {
    let group: CalendarPostedGroup
    @Environment(\.openURL) private var openURL

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            RemoteThumbnail(url: group.thumbnail.flatMap(URL.init(string:))) { Color.studioFaintFill }
                .frame(width: 32, height: 48)
                .clipShape(RoundedRectangle(cornerRadius: 4, style: .continuous))
            VStack(alignment: .leading, spacing: 4) {
                Text(group.title.isEmpty ? "Untitled" : group.title)
                    .font(.system(size: 11, weight: .semibold))
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
                HStack(spacing: 4) {
                    ForEach(group.posts, id: \.platform) { post in
                        Button {
                            if let url = URL(string: post.video.url) { openURL(url) }
                        } label: {
                            HStack(spacing: 4) {
                                PublishPlatformGlyph(platform: post.platform, size: 10)
                                Text(HomeNumber.compact(post.video.viewCount))
                                    .font(.system(size: 10, weight: .bold).monospacedDigit())
                            }
                            .foregroundStyle(.secondary)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Capsule().fill(Color.studioFaintFill))
                        }
                        .buttonStyle(.studioPlain)
                        .clickableCursor()
                        .help("Open on \(post.platform.label)")
                    }
                }
            }
            Spacer(minLength: 0)
        }
        .padding(6)
        .overlay(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .strokeBorder(Color.primary.opacity(0.15), lineWidth: 1)
        )
        .help(CalendarPostedCopy.describe(group))
    }
}

/// The platforms a post went out on, overlapping like an avatar stack.
private struct CalendarPlatformStack: View {
    let group: CalendarPostedGroup

    var body: some View {
        HStack(spacing: -4) {
            ForEach(group.posts, id: \.platform) { post in
                PublishPlatformGlyph(platform: post.platform, size: 10)
                    .frame(width: 16, height: 16)
                    .background(Circle().fill(Color.editorBackground))
                    .overlay(Circle().strokeBorder(Color.primary.opacity(0.15), lineWidth: 1))
            }
        }
    }
}

enum CalendarPostedCopy {
    /// "Title · YouTube 1.2K, TikTok 340 views"
    static func describe(_ group: CalendarPostedGroup) -> String {
        let where_ = group.posts
            .map { "\($0.platform.label) \(HomeNumber.compact($0.video.viewCount))" }
            .joined(separator: ", ")
        return "\(group.title.isEmpty ? "Untitled" : group.title) · \(where_) views"
    }
}
