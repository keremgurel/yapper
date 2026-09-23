import SwiftUI

/// The one explicit publish step: what goes out, where, TikTok's review when
/// TikTok is chosen, then publish now or schedule. One press sends every
/// chosen video to every chosen destination; Yapper never picks a platform
/// on its own.
struct PosterPublishSheet: View {
    @StateObject private var session: PosterPublishSession
    @StateObject private var schedule = PosterScheduleModel()
    @ObservedObject var connections: PosterConnectionStore
    @ObservedObject var drafts: PosterDraftStore
    let onClose: () -> Void

    init(request: PosterPublishSheetRequest, connections: PosterConnectionStore, drafts: PosterDraftStore, onClose: @escaping () -> Void) {
        _session = StateObject(wrappedValue: PosterPublishSession(request))
        self.connections = connections
        self.drafts = drafts
        self.onClose = onClose
    }

    var body: some View {
        let publishable = connections.publishable
        let chosen = session.chosen(from: publishable)
        let busy = session.posting || session.scheduling || session.scheduled
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(session.targets.count > 1 ? "Cross-post \(session.targets.count) videos" : "Cross-post video")
                        .font(.nativeSectionTitle)
                    Text("Choose every destination you want. One action publishes the full selection.")
                        .font(.system(size: 12)).foregroundStyle(.secondary)
                }
                Spacer()
                Button("Close", action: onClose).buttonStyle(EditorGhostButtonStyle(size: .small)).keyboardShortcut(.cancelAction)
            }
            .padding(20)
            Rectangle().fill(Color.studioLine).frame(height: 1)
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    PosterPreparedCaptions(targets: session.targets)
                    if connections.response == nil && connections.failed {
                        NativeErrorState(message: "Your connections couldn't be loaded.") { Task { await connections.refresh() } }
                    } else if connections.response == nil {
                        NativeLoadingState(label: "Loading your connections")
                    } else if publishable.isEmpty {
                        NativeEmptyState(systemImage: "link", title: "No channels connected",
                                         message: "Connect a channel in Connections, then publish from here.")
                    } else {
                        destinations(publishable, chosen: chosen, disabled: busy)
                        if chosen.contains(.tiktok) {
                            ForEach(session.targets) { target in
                                PosterTikTokReviewView(target: target, disabled: session.posting || !session.outcomes.isEmpty) { id, review in
                                    session.tiktokReviews[id] = review
                                }
                            }
                        }
                        if chosen.contains(.facebook) {
                            note("Facebook Reels are public on your selected Page. Use vertical videos, 3 to 90 seconds, at least 540 by 960 pixels.")
                        }
                        PosterOutcomeList(outcomes: session.outcomes)
                        if session.failures > 0 && session.done(chosen) {
                            Text("\(session.failures) destination\(session.failures == 1 ? "" : "s") failed. Successful posts were not rolled back.")
                                .font(.system(size: 12, weight: .semibold)).foregroundStyle(Color.studioDanger)
                        }
                        actions(chosen: chosen)
                    }
                }
                .padding(20)
            }
        }
        .frame(width: 560, height: 680)
        .background(Color.editorBackground)
        .task { if connections.response == nil { await connections.refresh() } }
    }

    private func destinations(_ publishable: [PublishPlatform], chosen: [PublishPlatform], disabled: Bool) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Destinations").font(.system(size: 13, weight: .semibold))
                Spacer()
                Button(chosen.count == publishable.count ? "Clear all" : "Select all") {
                    session.selected = chosen.count == publishable.count ? [] : Set(publishable)
                }
                .buttonStyle(EditorGhostButtonStyle(size: .small))
                .disabled(disabled)
            }
            ForEach(publishable) { platform in
                Toggle(isOn: Binding(get: { session.selected.contains(platform) }, set: { _ in session.toggle(platform) })) {
                    HStack(spacing: 8) {
                        Image(systemName: platform.symbol).foregroundStyle(.secondary)
                        Text(platform.label).font(.system(size: 13, weight: .medium))
                        Text(connections.accountLabel(for: platform)).font(.system(size: 12)).foregroundStyle(.secondary)
                    }
                }
                .toggleStyle(.checkbox)
                .disabled(disabled)
                .clickableCursor(enabled: !disabled)
            }
        }
        .nativeWell(padding: 12, radius: 10)
    }

    @ViewBuilder
    private func actions(chosen: [PublishPlatform]) -> some View {
        let videos = session.targets.count
        let done = session.done(chosen)
        let blocked = session.posting || !session.tiktokReady(chosen) || session.scheduling || chosen.isEmpty
        if !session.scheduled {
            Button { Task { await session.publish(to: chosen, connections: connections, drafts: drafts) } } label: {
                HStack(spacing: 6) {
                    if session.posting { ProgressView().controlSize(.mini) }
                    Text(session.posting ? "Publishing \(min(session.outcomes.count + 1, videos * chosen.count)) of \(videos * chosen.count)"
                         : done ? "Check publish status"
                         : "Publish \(plural(videos, "video")) to \(plural(chosen.count, "platform"))")
                }
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(EditorPrimaryButtonStyle())
            .disabled(blocked)
        }
        if session.outcomes.isEmpty && !chosen.contains(.tiktok) {
            PosterSchedulePanel(
                model: schedule, count: videos * chosen.count, includesTikTok: false, disabled: blocked,
                onSchedule: { scheduleNow(chosen) },
                onCalendar: {
                    onClose()
                    StudioNavigation.shared.goTo(.calendar)
                }
            )
        }
        note("YouTube posts are requested as public. For TikTok, review the audience and posting method above.")
            .frame(maxWidth: .infinity)
    }

    private func scheduleNow(_ chosen: [PublishPlatform]) {
        session.scheduling = true
        Task {
            let saved = await schedule.schedule(session.targets, to: chosen, connections: connections)
            session.scheduling = false
            guard saved else { return }
            session.scheduled = true
            for target in session.targets {
                for platform in chosen {
                    drafts.record(PosterOutcome(videoID: target.id, videoTitle: target.title, platform: platform, status: .scheduled))
                }
            }
        }
    }

    private func plural(_ count: Int, _ word: String) -> String { "\(count) \(word)\(count == 1 ? "" : "s")" }

    private func note(_ text: String) -> some View {
        Text(text).font(.system(size: 12)).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
    }
}
