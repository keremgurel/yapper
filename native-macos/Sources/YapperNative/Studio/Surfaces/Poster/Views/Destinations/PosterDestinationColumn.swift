import SwiftUI

/// Everywhere this video is going and everything it needs to get there: the
/// destinations, the caption writer, one card per destination, the YouTube
/// and TikTok settings, and the one button that prepares the video and sends
/// it to every chosen destination. There is no second review step.
struct PosterDestinationColumn: View {
    @ObservedObject private var projectPreparation = PosterProjectSync.shared
    let video: PosterVideo
    let framePending: Bool
    @ObservedObject var drafts: PosterDraftStore
    @ObservedObject var connections: PosterConnectionStore
    @ObservedObject var generator: PosterCaptionGenerator
    @ObservedObject var prep: PosterPublishPrep
    @StateObject private var session = PosterPublishSession()
    @StateObject private var schedule = PosterScheduleModel()
    @StateObject private var tiktok = PosterTikTokReviewModel()

    var body: some View {
        let connected = connections.connected
        let chosenSet = drafts.destinations(video, connected: connected)
        let chosen = PublishPlatform.enabledCases.filter(chosenSet.contains)
        let captions = drafts.captions(video)
        let cover = drafts.cover(video)
        let readiness = chosen.map { platform in
            PosterReadiness(platform: platform, connected: connected.contains(platform), caption: captions.caption(for: platform),
                            hasCover: cover.image != nil, outcome: drafts.outcome(video, platform))
        }
        // Posted and scheduled destinations are done; failed and unconfirmed
        // ones go again with the same attempt.
        let remaining = chosen.filter { platform in
            guard let outcome = drafts.outcome(video, platform) else { return true }
            return outcome.status == .failed || outcome.status == .pending
        }
        let retrying = remaining.contains { drafts.outcome(video, $0) != nil }
        let gate = PosterPublishGate(
            remaining: remaining, readiness: readiness.filter { remaining.contains($0.platform) },
            publishable: connections.publishable, videoReady: video.readyToPublish,
            youtube: session.youtube, youtubeDescription: captions.caption(for: .youtube).rendered,
            tiktokReady: tiktok.review(caption: captions.caption(for: .tiktok).rendered).ready
        )
        let busy = session.posting || prep.preparing || schedule.saving
        let later = schedule.later && schedule.enabled == true && !remaining.contains(.tiktok) && !retrying
        let finished = schedule.saved || (!chosen.isEmpty && remaining.isEmpty)

        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                PosterDestinationToggles(
                    chosen: chosenSet, connected: connected,
                    onToggle: { drafts.toggle($0, for: video, connected: connected) },
                    onConnect: connections.connect
                )
                if chosen.isEmpty {
                    Text("Choose at least one destination.").font(.system(size: 13)).foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity)
                } else {
                    PosterCaptionWriter(video: video, chosen: chosenSet, drafts: drafts, generator: generator)
                }
                ForEach(readiness, id: \.platform) { item in
                    PosterDestinationCard(
                        readiness: item, caption: captions.caption(for: item.platform),
                        sending: busy && remaining.contains(item.platform),
                        onChange: { drafts.setCaption($0, for: video) },
                        onRemove: { drafts.toggle(item.platform, for: video, connected: connected) },
                        canReuse: chosen.count > 1 && !generator.generating,
                        onCopy: { drafts.copyCaption(from: item.platform, to: chosenSet, for: video) },
                        onGenerateOthers: {
                            generate(chosen.filter { $0 != item.platform }, reference: captions.caption(for: item.platform).rendered)
                        }
                    )
                }
                if !chosen.isEmpty {
                    PosterPublishOptions(
                        video: video, chosen: remaining, youtubeDescriptionTooLong: gate.youtubeDescriptionTooLong,
                        showsWhen: schedule.saved || (!finished && !retrying && !remaining.contains(.tiktok)),
                        session: session, tiktok: tiktok, schedule: schedule
                    )
                }
                PosterCaptionBriefView(value: drafts.brief(video), disabled: generator.generating) {
                    drafts.setBrief($0, for: video)
                }
            }
            .disabled(busy)
        }
        .safeAreaInset(edge: .bottom, spacing: 12) {
            if !chosen.isEmpty {
                PosterPublishBar(
                    label: label(remaining: remaining, later: later, retrying: retrying),
                    busy: busy, canSend: gate.canSend, finished: finished,
                    failures: chosen.filter { drafts.outcome(video, $0)?.status == .failed }.count,
                    waiting: video.readyToPublish ? gate.waiting.map(\.label) : [],
                    tiktokChosen: remaining.contains(.tiktok),
                    onSend: { send(to: remaining, captions: captions, cover: cover, later: later) },
                    onNext: next
                )
            }
        }
    }

    private func label(remaining: [PublishPlatform], later: Bool, retrying: Bool) -> String {
        if prep.preparing || !video.readyToPublish { return preparationLabel }
        if schedule.saving { return "Scheduling…" }
        if session.posting { return "Publishing \(min(session.outcomes.count + 1, remaining.count)) of \(remaining.count)…" }
        if later {
            let when = PosterQuickTimes.label(schedule.when)
            return remaining.count == 1 ? "Schedule for \(when)" : "Schedule \(remaining.count) posts for \(when)"
        }
        if retrying { return "Check publish status" }
        return "Publish 1 video to \(remaining.count) platform\(remaining.count == 1 ? "" : "s")"
    }

    private var preparationLabel: String {
        if case let .project(listing) = video.origin,
           let status = projectPreparation.status[listing.summary.id] { return status }
        return "Preparing video…"
    }

    private func generate(_ platforms: [PublishPlatform], reference: String) {
        Task {
            await generator.generate(for: video, platforms: platforms, brief: drafts.brief(video), titleOnly: false, into: drafts, reference: reference)
        }
    }

    /// One press: prepare the video, then send it everywhere still to go, or
    /// save it to send later.
    private func send(to remaining: [PublishPlatform], captions: PosterCaptionSet, cover: PosterCoverDraft, later: Bool) {
        guard session.begin() else { return }
        Task {
            defer { session.end() }
            guard let target = await prep.prepare(video, cover: cover, captions: captions, destinations: Set(remaining)) else { return }
            if later {
                guard await schedule.schedule([target], to: remaining, youtube: session.youtube, connections: connections) else { return }
                for platform in remaining {
                    drafts.record(PosterOutcome(videoID: target.id, videoTitle: target.title, platform: platform, status: .scheduled))
                }
            } else {
                let copy = target.copy(for: .tiktok)
                let review = remaining.contains(.tiktok) ? tiktok.review(caption: copy.body.isEmpty ? copy.title : copy.body) : nil
                await session.publish(target, to: remaining, tiktok: review, connections: connections, drafts: drafts)
            }
        }
    }

    private func next() {
        PosterBench.shared.close()
        Task { await PosterLibraryStore.shared.refresh() }
    }
}
