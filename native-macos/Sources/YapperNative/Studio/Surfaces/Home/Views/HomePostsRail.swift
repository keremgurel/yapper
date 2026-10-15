import SwiftUI

struct HomePostsRail: View {
    enum Mode: Hashable { case today, recent, top }
    let ranked: [HomeRankedVideo]?
    let connected: [PublishPlatform]
    let now: Date
    @State private var mode = Mode.today
    @State private var rotation = 0
    @ObservedObject private var auth = StudioAuth.shared
    private var hiddenKey: String { "yapper.home-hidden.v1.\(auth.account?.userID ?? "preview")" }
    private var hidden: [String: Double] {
        (UserDefaults.standard.dictionary(forKey: hiddenKey) as? [String: Double] ?? [:]).filter { $0.value > now.timeIntervalSince1970 }
    }
    private func dismiss(_ group: HomeVideoGroup) {
        var next = hidden
        for post in group.posts { next[post.id] = now.timeIntervalSince1970 + 7 * 86400 }
        UserDefaults.standard.set(next, forKey: hiddenKey)
        rotation += 1
    }

    var body: some View {
        NativeSection(title: "Worth your attention", meta: mode == .today ? "A daily shortlist from your posts" : "Cross-posts grouped by source or matching titles") {
            NativeSegmented(options: [.init(value: Mode.today, label: "For today"), .init(value: Mode.recent, label: "Recent"), .init(value: Mode.top, label: "Top")], selection: $mode)
        } content: {
            VStack(alignment: .leading, spacing: 12) {
                content
                if !hidden.isEmpty {
                    Button("Reset hidden suggestions") { UserDefaults.standard.removeObject(forKey: hiddenKey); rotation += 1 }
                        .buttonStyle(EditorGhostButtonStyle(size: .small))
                }
            }
        }
    }

    @ViewBuilder private var content: some View {
        if let ranked {
            let groups = HomeOpportunities.groups(ranked)
            if mode == .today {
                let eligible = groups.filter { group in !group.posts.contains { hidden[$0.id] != nil } }
                let opportunities = HomeOpportunities.suggestions(eligible, videos: ranked, connected: connected, now: now, rotation: rotation)
                if opportunities.isEmpty {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Nothing to flag from your posts today").font(.system(size: 14, weight: .medium))
                        Text("Keep moving on your next idea. We’ll surface recent standouts and possible sharing gaps when there’s enough channel history.")
                            .font(.system(size: 13)).foregroundStyle(.secondary)
                        Button("Open ideas") { StudioNavigation.shared.goTo(.ideas) }.buttonStyle(EditorSecondaryButtonStyle())
                    }.padding(.vertical, 16)
                } else {
                    VStack(alignment: .leading, spacing: 16) {
                        ForEach(opportunities) { item in
                            HomeOpportunityRow(group: item.group, opportunity: item, onDismiss: { dismiss(item.group) })
                            if item.id != opportunities.last?.id { Divider() }
                        }
                        HStack {
                            Text("Based on loaded history. Suggestions rotate daily.").font(.system(size: 12)).foregroundStyle(.secondary)
                            Spacer()
                            if HomeOpportunities.suggestions(eligible, videos: ranked, connected: connected, now: now, rotation: rotation + 1).map(\.id) != opportunities.map(\.id) {
                                Button("Show another mix") { rotation += 1 }.buttonStyle(EditorGhostButtonStyle(size: .small))
                            }
                        }
                    }
                }
            } else {
                let posts = mode == .top ? groups : groups.sorted { $0.publishedAt > $1.publishedAt }
                VStack(alignment: .leading, spacing: 16) {
                    ForEach(Array(posts.prefix(4))) { group in
                        HomeOpportunityRow(group: group)
                        if group.id != posts.prefix(4).last?.id { Divider() }
                    }
                }
            }
        } else {
            NativeLoadingState(label: "Loading your posts…")
        }
    }
}

private struct HomeOpportunityRow: View {
    let group: HomeVideoGroup
    var opportunity: HomeOpportunity?
    var onDismiss: (() -> Void)?
    @State private var saving = false
    @State private var saved = false
    @State private var failed = false
    @Environment(\.openURL) private var openURL

    var body: some View {
        HStack(alignment: .top, spacing: 16) {
            RemoteThumbnail(url: group.primary.video.thumbnail.flatMap(URL.init(string:)))
                .frame(width: 80, height: 112)
                .background(Color.studioFaintFill)
                .clipShape(RoundedRectangle(cornerRadius: 8))
            VStack(alignment: .leading, spacing: 8) {
                if let opportunity { Text(opportunity.heading).font(.system(size: 14, weight: .semibold)) }
                Text(group.primary.video.displayTitle).font(.system(size: 14, weight: .medium)).fixedSize(horizontal: false, vertical: true)
                if let opportunity { Text(opportunity.reason).font(.system(size: 13)).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true) }
                ViewThatFits(in: .horizontal) {
                    HStack(spacing: 12) { platforms }
                    VStack(alignment: .leading, spacing: 4) { platforms }
                }
                if group.posts.count > 1 { Text("\(HomeNumber.compact(group.views)) combined views").font(.system(size: 12)).foregroundStyle(.secondary) }
                if let opportunity {
                    if opportunity.kind == .share {
                        Button("Review in Poster") { StudioNavigation.shared.goTo(.poster) }.buttonStyle(EditorSecondaryButtonStyle())
                    } else {
                        Button(saved ? "Saved to ideas" : saving ? "Saving…" : "Capture this angle") { capture(opportunity) }
                            .buttonStyle(EditorSecondaryButtonStyle()).disabled(saving || saved)
                    }
                }
                if opportunity != nil {
                    Button("Hide for a week") { onDismiss?() }.buttonStyle(EditorGhostButtonStyle(size: .small)).disabled(saving)
                }
                if failed { Text("Couldn’t save the idea. Try again.").font(.system(size: 12)).foregroundStyle(.red) }
            }.frame(maxWidth: .infinity, alignment: .leading)
        }
    }
    @ViewBuilder private var platforms: some View {
        ForEach(group.posts) { post in
            Button {
                if let url = URL(string: post.video.url) { openURL(url) }
            } label: {
                HStack(spacing: 6) {
                    PublishPlatformGlyph(platform: post.platform, size: 14)
                    Text("\(post.platform.label) \(HomeNumber.compact(post.video.viewCount))").font(.system(size: 12))
                }.padding(.vertical, 4)
            }.buttonStyle(.studioPlain).help("Open on \(post.platform.label)")
        }
    }
    private func capture(_ item: HomeOpportunity) {
        saving = true
        failed = false
        Task {
            do { try await IdeaCapture.shared.capture(item.captureText); saved = true }
            catch { failed = true }
            saving = false
        }
    }
}
