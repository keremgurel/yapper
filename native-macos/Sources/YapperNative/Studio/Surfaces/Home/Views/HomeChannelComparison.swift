import SwiftUI
struct HomeChannelComparison: View {
    let performance: HomeRecentPerformance?
    var body: some View {
        NativeSection(title: "Your channels", meta: "Same 30-day window") {
            Button("Manage") { StudioNavigation.shared.goTo(.connections) }.buttonStyle(EditorGhostButtonStyle(size: .small))
        } content: {
            VStack(alignment: .leading, spacing: 16) {
                if let performance {
                    ForEach(performance.channels) { channel in
                        VStack(alignment: .leading, spacing: 12) {
                            HStack {
                                PublishPlatformGlyph(platform: channel.platform, size: 16)
                                Text(channel.platform.label).font(.system(size: 14, weight: .medium))
                                Spacer()
                                Text(HomeNumber.compact(channel.views)).font(.system(size: 18, weight: .semibold)).monospacedDigit()
                            }
                            GeometryReader { geometry in
                                ZStack(alignment: .leading) {
                                    Color.studioFaintFill
                                    HomeChartColor.color(channel.platform).frame(width: performance.totalViews > 0 ? geometry.size.width * CGFloat(channel.views) / CGFloat(performance.totalViews) : 0)
                                }.clipShape(Capsule())
                            }.frame(height: 6).accessibilityHidden(true)
                            HStack {
                                Text("\(channel.posts) \(channel.posts == 1 ? "post" : "posts")")
                                Spacer()
                                Text("\(HomeNumber.compact(channel.typical)) median views per post")
                            }.font(.system(size: 12)).foregroundStyle(.secondary)
                        }.padding(.vertical, 4)
                        if channel.id != performance.channels.last?.id { Divider() }
                    }
                } else { NativeLoadingState(label: "Loading channels…") }
                Text("Current views on posts from the last 30 days. Each channel counts its own copy of a video.")
                    .font(.system(size: 12)).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}
