import AppKit
import SwiftUI

/// Home: what's in the pipeline, what to make next, and how the channels are
/// doing. The stores keep their last read, so returning here shows it at once
/// while a fresh read runs behind it.
struct HomePage: View {
    @ObservedObject private var channelsStore: HomeChannelsStore = .shared
    @ObservedObject private var itemsStore: HomeItemsStore = .shared
    @ObservedObject private var connectionsStore: ConnectionsStore = .shared

    var body: some View {
        let channels = channelsStore.channels
        let ranked = HomeRanking.rankVideos(channels)
        let connections = connectionsStore.response?.connections
        let connectionsFailed = connectionsStore.error != nil
        let channelFailed = channelsStore.anyFailed

        NativePage {
            NativePageHeader(
                title: "Home",
                description: "What's in the pipeline, what to make next, and how your channels are doing."
            ) {
                Button { StudioNavigation.shared.goTo(.ideas) } label: {
                    Label("Idea Bank", systemImage: "lightbulb")
                }
                .buttonStyle(EditorSecondaryButtonStyle())
                Button { StudioNavigation.shared.goTo(.editor) } label: {
                    Label("Open editor", systemImage: "plus")
                }
                .buttonStyle(EditorPrimaryButtonStyle())
            }

            VStack(alignment: .leading, spacing: 32) {
                if channelFailed || itemsStore.pipelineFailed || itemsStore.ideasFailed || connectionsFailed {
                    HomeRefreshNotice { Task { await refresh() } }
                }
                HomePerformanceBand(
                    loaded: channels != nil,
                    unavailable: channelFailed || connectionsFailed,
                    totalViews: ranked.reduce(0) { $0 + $1.video.viewCount },
                    postCount: ranked.count,
                    averageViews: ranked.isEmpty ? 0 : Int((Double(ranked.reduce(0) { $0 + $1.video.viewCount }) / Double(ranked.count)).rounded()),
                    connectedCount: PublishPlatform.allCases.filter {
                        HomeRanking.isConnected($0, channels: channels, connections: connections)
                    }.count
                )
                HomeSplitLayout {
                    HomeUpNextSection(items: itemsStore.pipeline, failed: itemsStore.pipelineFailed)
                    HomeDailyIdeasSection(ideas: HomeDailyIdeas.make(saved: itemsStore.ideas ?? [], topVideo: ranked.first))
                }
                HomeSplitLayout {
                    HomeTopContentSection(ranked: channels == nil ? nil : ranked, unavailable: channelFailed)
                    HomeChannelsSection(
                        channels: channels,
                        connections: connections,
                        connectionsLoading: connectionsStore.loading,
                        connectionsUnavailable: connectionsFailed
                    )
                }
            }
        }
        .task { await refresh(channelMaxAge: 60) }
        .onReceive(NotificationCenter.default.publisher(for: NSWindow.didBecomeKeyNotification)) { _ in
            Task { await refresh(channelMaxAge: 60) }
        }
    }

    private func refresh(channelMaxAge: TimeInterval = 0) async {
        async let channels: Void = channelsStore.refresh(maxAge: channelMaxAge)
        async let items: Void = itemsStore.refresh()
        async let connections: Void = connectionsStore.refresh()
        _ = await (channels, items, connections)
    }
}

/// Some reads failed: say so once, with the one action that retries them.
private struct HomeRefreshNotice: View {
    let retry: () -> Void
    var body: some View {
        HStack(spacing: 12) {
            Text("Some Studio data couldn't be loaded. Refresh to check your channels, Library, and ideas again.")
                .font(.system(size: 13))
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
            Button("Refresh", action: retry).buttonStyle(EditorSecondaryButtonStyle(size: .small))
        }
        .nativeCard(padding: 16, radius: 12)
    }
}
