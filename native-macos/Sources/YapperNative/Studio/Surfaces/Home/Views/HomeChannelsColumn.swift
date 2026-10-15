import SwiftUI

/// The left column once a channel is connected: the numbers, the posts and
/// the time saved. Connected with nothing posted, a row of zeros would read
/// as failure, so it says where the numbers will come from instead.
struct HomeChannelsColumn: View {
    let channels: HomeDashboard.Channels

    var body: some View {
        let performance = channels.ranked.map { HomeRecentPerformance(videos: $0, connected: channels.connected, now: channels.now) }
        VStack(alignment: .leading, spacing: 32) {
            HomeStatsBand(stats: performance, missing: channels.missing)
            HomeSplitLayout {
                HomePostsRail(performance: performance)
                HomeChannelComparison(performance: performance)
            }
        }
    }
}
