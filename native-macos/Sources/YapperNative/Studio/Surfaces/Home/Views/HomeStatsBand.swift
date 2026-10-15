import SwiftUI

/// The channel numbers in one card: four figures split by hairlines, then
/// where the views come from. Nil stats keep the shape as skeletons while
/// channel history loads.
struct HomeStatsBand: View {
    let stats: HomeChannelStats?
    /// Channels whose history failed, named so the totals are not misread.
    let missing: String

    private struct Block {
        let label: String
        let value: Int
        let detail: String?
    }

    private var blocks: [Block] {
        [
            Block(label: "Loaded views", value: stats?.totalViews ?? 0,
                  detail: stats.map { "Across \(HomeNumber.compact($0.postCount)) loaded posts" }),
            Block(label: "Recent posts’ views", value: stats?.recentViews ?? 0,
                  detail: "Lifetime views on posts from the last 30 days"),
            Block(label: "Typical post", value: stats?.typical ?? 0,
                  detail: "Views on your middle post"),
            Block(label: "Posted this week", value: stats?.postsThisWeek ?? 0,
                  detail: stats.map { "Usually \($0.usualPerWeek) a week" }),
        ]
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 0) {
                ForEach(Array(blocks.enumerated()), id: \.offset) { index, block in
                    if index > 0 { Rectangle().fill(Color.studioLine).frame(width: 1) }
                    cell(block)
                }
            }
            .fixedSize(horizontal: false, vertical: true)

            if let stats, stats.platforms.count > 1 || !missing.isEmpty {
                Rectangle().fill(Color.studioLine).frame(height: 1)
                shares(stats)
            }
        }
        .background(NativeCardBackground(radius: 12))
    }

    private func cell(_ block: Block) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(block.label).font(.nativeLabel).foregroundStyle(.secondary)
            if stats == nil {
                RoundedRectangle(cornerRadius: 6).fill(Color.studioFaintFill).frame(width: 72, height: 28)
            } else {
                Text(HomeNumber.compact(block.value))
                    .font(.system(size: 24, weight: .semibold).monospacedDigit())
                    .contentTransition(.numericText())
            }
            Text(block.detail ?? " ")
                .font(.system(size: 12))
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 18)
        .padding(.vertical, 16)
    }

    private func shares(_ stats: HomeChannelStats) -> some View {
        HStack(spacing: 20) {
            ForEach(stats.platforms, id: \.platform) { share in
                HStack(spacing: 6) {
                    PublishPlatformGlyph(platform: share.platform, size: 14)
                    Text(share.platform.label)
                    Text("\(Int((Double(share.views) / Double(max(stats.totalViews, 1)) * 100).rounded()))%")
                        .font(.system(size: 12, weight: .semibold, design: .monospaced))
                        .foregroundStyle(.primary)
                }
            }
            if !missing.isEmpty {
                Text("\(missing) didn’t load, so it’s left out")
            }
            Spacer(minLength: 0)
        }
        .font(.system(size: 12))
        .foregroundStyle(.secondary)
        .padding(.horizontal, 18)
        .padding(.vertical, 12)
    }

    static func changeLine(_ change: Double?) -> String {
        guard let change else { return "Posts from the last 30 days" }
        let percent = Int((abs(change) * 100).rounded())
        if percent == 0 { return "Level with the 30 days before" }
        return "\(change > 0 ? "Up" : "Down") \(percent)% on the 30 days before"
    }
}
