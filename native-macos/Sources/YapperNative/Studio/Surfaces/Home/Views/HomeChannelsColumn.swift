import SwiftUI

/// The left column once a channel is connected: the numbers, the posts and
/// the time saved. Connected with nothing posted, a row of zeros would read
/// as failure, so it says where the numbers will come from instead.
struct HomeChannelsColumn<Saved: View>: View {
    let channels: HomeDashboard.Channels
    @ViewBuilder var saved: () -> Saved

    var body: some View {
        VStack(alignment: .leading, spacing: 32) {
            if channels.ranked?.isEmpty == true {
                NativeEmptyState(
                    systemImage: "chart.bar",
                    title: "Your numbers start with your first post",
                    message: channels.missing.isEmpty
                        ? "Views and your typical post show up here once you publish."
                        : "\(channels.missing) didn’t load. Refresh to try again."
                ) { EmptyView() }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 24)
                .background(NativeCardBackground(radius: 12))
            } else {
                HomeStatsBand(stats: channels.stats, missing: channels.missing)
                HomePostsRail(ranked: channels.ranked, connected: channels.connected, now: channels.now)
            }
            saved()
        }
    }
}
