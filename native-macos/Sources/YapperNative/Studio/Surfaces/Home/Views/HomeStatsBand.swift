import SwiftUI

/// The channel numbers in one card: four figures split by hairlines, then
/// where the views come from. Nil stats keep the shape as skeletons while
/// channel history loads.
struct HomeStatsBand: View {
    let stats: HomeRecentPerformance?
    /// Channels whose history failed, named so the totals are not misread.
    let missing: String

    private struct Block {
        let label: String
        let value: Int
        let detail: String?
    }

    private var blocks: [Block] {
        [
            Block(label: "Views on recent videos", value: stats?.totalViews ?? 0, detail: "Current totals across your channels"),
            Block(label: "Unique videos", value: stats?.groups.count ?? 0, detail: stats.map { "Across \($0.postCount) platform posts" }),
            Block(label: "Typical video", value: stats?.typical ?? 0, detail: "Median views, cross-posts combined"),
            Block(label: "Posted this week", value: stats?.thisWeek ?? 0, detail: "Unique videos in the past 7 days"),
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

            if !missing.isEmpty {
                Divider()
                Text("\(missing) didn’t load, so those posts are left out. Check Connections to try again.").font(.system(size: 12)).foregroundStyle(.secondary).padding(16)
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

    static func changeLine(_ change: Double?) -> String {
        guard let change else { return "Posts from the last 30 days" }
        let percent = Int((abs(change) * 100).rounded())
        if percent == 0 { return "Level with the 30 days before" }
        return "\(change > 0 ? "Up" : "Down") \(percent)% on the 30 days before"
    }
}
