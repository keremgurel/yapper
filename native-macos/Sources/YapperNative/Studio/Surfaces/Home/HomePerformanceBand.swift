import SwiftUI

/// The four channel numbers in one card, split by hairlines. While channel
/// history loads each cell keeps its shape as a quiet skeleton.
struct HomePerformanceBand: View {
    let loaded: Bool
    let unavailable: Bool
    let totalViews: Int
    let postCount: Int
    let averageViews: Int
    let connectedCount: Int

    private var stats: [(label: String, value: String, detail: String)] {
        [
            ("Total views", HomeNumber.compact(totalViews), "All loaded channel history"),
            ("Posts", HomeNumber.compact(postCount), "Across every channel"),
            ("Average views", HomeNumber.compact(averageViews), "Per published post"),
            ("Channels", "\(connectedCount)/\(PublishPlatform.allCases.count)", "Connected for publishing"),
        ]
    }

    var body: some View {
        HStack(spacing: 0) {
            ForEach(Array(stats.enumerated()), id: \.offset) { index, stat in
                if index > 0 { Rectangle().fill(Color.studioLine).frame(width: 1) }
                cell(stat)
            }
        }
        .fixedSize(horizontal: false, vertical: true)
        .background(NativeCardBackground())
    }

    private func cell(_ stat: (label: String, value: String, detail: String)) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(stat.label).font(.nativeLabel).foregroundStyle(.secondary)
            if loaded {
                Text(unavailable ? "n/a" : stat.value)
                    .font(.system(size: 24, weight: .semibold).monospacedDigit())
            } else {
                RoundedRectangle(cornerRadius: 6).fill(Color.studioFaintFill).frame(width: 72, height: 28)
            }
            Text(unavailable ? "Some data couldn't be loaded" : stat.detail)
                .font(.system(size: 12))
                .foregroundStyle(.secondary)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 20)
        .padding(.vertical, 18)
    }
}
