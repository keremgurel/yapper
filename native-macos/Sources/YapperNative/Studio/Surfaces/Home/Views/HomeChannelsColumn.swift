import SwiftUI

struct HomeChannelsColumn: View {
    let channels: HomeDashboard.Channels
    var body: some View {
        let performance = channels.ranked.map { HomeRecentPerformance(videos: $0, connected: channels.connected, now: channels.now) }
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Your content").font(.system(size: 14, weight: .semibold))
                Spacer()
                Text("Last 30 days").font(.system(size: 12)).foregroundStyle(.secondary)
            }.padding(.horizontal, 18).padding(.top, 16)
            HomeStatsBand(stats: performance, missing: channels.missing, embedded: true)
            HomeViewsChart(performance: performance).padding(.horizontal, 18).padding(.bottom, 12)
        }.background(NativeCardBackground(radius: 12))
    }
}
