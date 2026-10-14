import SwiftUI

/// The left column once a channel is connected: the numbers, the posts and
/// the posting rhythm. Connected with nothing posted, a row of zeros would
/// read as failure, so it says where the numbers will come from instead.
struct HomeChannelsColumn: View {
    let channels: HomeDashboard.Channels

    var body: some View {
        if channels.ranked?.isEmpty == true {
            NativeEmptyState(
                systemImage: "chart.bar",
                title: "Your numbers start with your first post",
                message: channels.missing.isEmpty
                    ? "Views, your typical post and your posting rhythm show up here once you publish."
                    : "\(channels.missing) didn’t load. Refresh to try again."
            ) { EmptyView() }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 24)
            .background(NativeCardBackground(radius: 12))
        } else {
            VStack(alignment: .leading, spacing: 32) {
                HomeStatsBand(stats: channels.stats, missing: channels.missing)
                HomePostsRail(ranked: channels.ranked, typical: channels.stats?.typical ?? 0)
                if let stats = channels.stats, let weeks = channels.weeks, channels.ranked?.isEmpty == false {
                    HomePostingRhythm(weeks: weeks, thisWeek: stats.postsThisWeek, usual: stats.usualPerWeek)
                }
            }
        }
    }
}
