import AppKit
import SwiftUI

/// Home: capture first, then what to work on, then how the posts are doing.
/// The same page as the web's Home, reshaping itself around where the
/// creator is (see `HomeDashboard`). The stores keep their last read, so
/// returning here paints at once while a fresh read runs behind it.
struct HomePage: View {
    @ObservedObject private var channelsStore: HomeChannelsStore = .shared
    @ObservedObject private var ideas: IdeasStore = .shared
    @ObservedObject private var capture: IdeaCapture = .shared
    @ObservedObject private var connections: ConnectionsStore = .shared
    @ObservedObject private var brain: BrainProjectStore = .shared
    @ObservedObject private var auth: StudioAuth = .shared
    @Namespace private var composerSpace
    @State private var expanded = false
    /// One clock per visit, so the numbers do not shift while the page is open.
    @State private var now = Date()

    private var dashboard: HomeDashboard {
        HomeDashboard(
            channels: channelsStore.channels,
            connections: connections.response?.connections,
            connectionsFailed: connections.error != nil,
            items: ideas.loadError == nil ? ideas.items : nil,
            brainStarted: brain.project.map { HomeSetupStep.brainStarted($0, pillarCount: brain.pillars.count) },
            now: now
        )
    }

    var body: some View {
        let dashboard = dashboard
        ZStack {
            NativePage {
                NativePageHeader(
                    title: HomeGreeting.text(
                        hour: Calendar.current.component(.hour, from: now),
                        firstName: HomeGreeting.firstName(from: auth.account)
                    ),
                    description: HomeDashboard.subtitle(hasIdeas: !(ideas.items ?? []).isEmpty)
                )
                if expanded {
                    Color.clear.frame(height: 96)
                } else {
                    HomeCaptureSection(namespace: composerSpace, onExpand: toggleExpanded)
                }
                VStack(alignment: .leading, spacing: 32) {
                    if let steps = dashboard.setup { HomeSetupTrack(steps: steps) }
                    if let channels = dashboard.channels {
                        HomeSplitLayout {
                            HomeChannelsColumn(channels: channels)
                            queue(dashboard)
                        }
                    } else {
                        queue(dashboard)
                    }
                }
                .padding(.top, 24)
            }
            if expanded {
                IdeaComposerFullWindow(namespace: composerSpace, onCollapse: toggleExpanded)
                    .zIndex(1)
            }
        }
        .task { await refresh(channelMaxAge: 60) }
        .onReceive(NotificationCenter.default.publisher(for: NSWindow.didBecomeKeyNotification)) { _ in
            Task { await refresh(channelMaxAge: 60) }
        }
    }

    /// A brand-new creator's empty queue would only repeat setup's first step.
    @ViewBuilder
    private func queue(_ dashboard: HomeDashboard) -> some View {
        if dashboard.setup == nil || !(ideas.items ?? []).isEmpty {
            HomeUpNextSection(
                items: ideas.items,
                shaping: capture.working,
                failed: ideas.loadError != nil && ideas.items == nil,
                onRetry: { Task { await ideas.refresh() } }
            )
        }
    }

    private func toggleExpanded() {
        withAnimation(.spring(response: 0.38, dampingFraction: 0.86)) { expanded.toggle() }
    }

    private func refresh(channelMaxAge: TimeInterval) async {
        async let channels: Void = channelsStore.refresh(maxAge: channelMaxAge)
        async let items: Void = ideas.refresh()
        async let links: Void = connections.refresh()
        async let project: Void = brain.refresh()
        _ = await (channels, items, links, project)
    }
}
