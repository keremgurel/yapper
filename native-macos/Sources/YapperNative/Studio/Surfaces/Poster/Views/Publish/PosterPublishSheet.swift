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
        NativeDrawer(onClose: onClose) {
            VStack(alignment: .leading, spacing: 4) {
                Text(session.targets.count > 1 ? "Publish \(session.targets.count) videos" : "Publish video")
                    .font(.system(size: 17, weight: .semibold))
                Text("Pick where it goes. One press sends it everywhere you chose.")
                    .font(.system(size: 12)).foregroundStyle(.secondary)
            }
        } content: {
            NativeSection(title: "Captions") {
                PosterPreparedCaptions(targets: session.targets)
            }
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
                    NativeSection(title: "TikTok review") {
                        ForEach(session.targets) { target in
                            PosterTikTokReviewView(target: target, disabled: session.posting || !session.outcomes.isEmpty) { id, review in
                                session.tiktokReviews[id] = review
                            }
                        }
                    }
                }
                if chosen.contains(.facebook) {
                    note("Facebook Reels are public on your selected Page. Use vertical videos, 3 to 90 seconds, at least 540 by 960 pixels.")
                }
                if session.outcomes.isEmpty && !chosen.contains(.tiktok) {
                    PosterSchedulePanel(
                        model: schedule, count: session.targets.count * chosen.count, includesTikTok: false,
                        disabled: session.posting || session.scheduling || chosen.isEmpty,
                        onSchedule: { scheduleNow(chosen) },
                        onCalendar: {
                            onClose()
                            StudioNavigation.shared.goTo(.calendar)
                        }
                    )
                }
                PosterOutcomeList(outcomes: session.outcomes)
            }
        } footer: {
            if session.failures > 0 && session.done(chosen) {
                Text("\(session.failures) destination\(session.failures == 1 ? "" : "s") failed. Successful posts were not rolled back.")
                    .font(.system(size: 12, weight: .semibold)).foregroundStyle(Color.studioDanger)
            }
            publishButton(chosen: chosen)
            note("YouTube posts go out as public. TikTok follows the review above.")
        }
        .task { if connections.response == nil { await connections.refresh() } }
    }

    private func destinations(_ publishable: [PublishPlatform], chosen: [PublishPlatform], disabled: Bool) -> some View {
        NativeSection(title: "Destinations", meta: "\(chosen.count) of \(publishable.count)") {
            Button(chosen.count == publishable.count ? "Clear all" : "Select all") {
                session.selected = chosen.count == publishable.count ? [] : Set(publishable)
            }
            .buttonStyle(EditorGhostButtonStyle(size: .small))
            .disabled(disabled)
        } content: {
            VStack(spacing: 0) {
                ForEach(Array(publishable.enumerated()), id: \.element) { index, platform in
                    if index > 0 { Rectangle().fill(Color.studioLine).frame(height: 1).padding(.leading, 48) }
                    destinationRow(platform, on: session.selected.contains(platform), disabled: disabled)
                }
            }
            .background(NativeCardBackground(radius: 12))
        }
    }

    private func destinationRow(_ platform: PublishPlatform, on: Bool, disabled: Bool) -> some View {
        Button { session.toggle(platform) } label: {
            HStack(spacing: 12) {
                Image(systemName: platform.symbol)
                    .font(.system(size: 14))
                    .foregroundStyle(.secondary)
                    .frame(width: 24)
                VStack(alignment: .leading, spacing: 1) {
                    Text(platform.label).font(.system(size: 13, weight: .semibold))
                    Text(connections.accountLabel(for: platform)).font(.system(size: 12)).foregroundStyle(.secondary).lineLimit(1)
                }
                Spacer(minLength: 8)
                Image(systemName: on ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 18))
                    .foregroundStyle(on ? Color.yapperOrange : Color.secondary.opacity(0.5))
                    .contentTransition(.symbolEffect(.replace))
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 11)
            .contentShape(Rectangle())
        }
        .buttonStyle(.studioPlain)
        .disabled(disabled)
        .animation(.snappy(duration: 0.18), value: on)
    }

    private func publishButton(chosen: [PublishPlatform]) -> some View {
        let videos = session.targets.count
        let done = session.done(chosen)
        let blocked = session.posting || !session.tiktokReady(chosen) || session.scheduling || chosen.isEmpty || session.scheduled
        return Button { Task { await session.publish(to: chosen, connections: connections, drafts: drafts) } } label: {
            HStack(spacing: 6) {
                if session.posting { ProgressView().controlSize(.mini) }
                Text(session.scheduled ? "Scheduled"
                     : session.posting ? "Publishing \(min(session.outcomes.count + 1, videos * chosen.count)) of \(videos * chosen.count)"
                     : done ? "Check publish status"
                     : "Publish \(plural(videos, "video")) to \(plural(chosen.count, "platform"))")
            }
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(EditorPrimaryButtonStyle())
        .disabled(blocked)
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
