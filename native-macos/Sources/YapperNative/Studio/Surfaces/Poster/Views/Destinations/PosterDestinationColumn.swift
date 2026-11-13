import SwiftUI

/// Everywhere this video is going and everything it needs to get there: the
/// destinations, the caption writer, one card per destination, the YouTube
/// and TikTok settings, and the one button that prepares the video and sends
/// it to every chosen destination. There is no second review step.
struct PosterDestinationColumn: View {
    @ObservedObject private var projectPreparation = PosterProjectSync.shared
    let video: PosterVideo
    @ObservedObject var drafts: PosterDraftStore
    @ObservedObject var connections: PosterConnectionStore
    @ObservedObject var generator: PosterCaptionGenerator
    @ObservedObject var prep: PosterPublishPrep
    @Binding var locked: Bool
    @State private var showSettings = false
    @State private var settingsPlatform: PublishPlatform?
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
        let later = schedule.later && schedule.enabled == true && !retrying
        let finished = schedule.saved || (!chosen.isEmpty && remaining.isEmpty)

        VStack(alignment: .leading, spacing: 0) {
            PosterComposerRow(label: "Post to") {
                VStack(alignment: .leading, spacing: 8) {
                    HStack(alignment: .top, spacing: 8) {
                        PosterDestinationToggles(chosen: chosenSet, connected: connected,
                            onToggle: { drafts.toggle($0, for: video, connected: connected) },
                            onConnect: connections.connect)
                        Spacer(minLength: 0)
                        Button {
                            openSettings()
                        } label: {
                            Image(systemName: "gearshape").accessibilityHidden(true)
                        }
                        .buttonStyle(EditorSecondaryButtonStyle(size: .small))
                        .accessibilityLabel("Posting settings").help("Posting settings")
                        .disabled(chosen.isEmpty)
                    }
                    HStack(spacing: 12) {
                        if chosen.contains(.youtube) {
                            Text("YouTube · \(session.youtube.visibility.label)")
                                .font(.studioLabel).foregroundStyle(.secondary)
                        }
                        if chosen.contains(.youtube), session.youtube.madeForKids == nil {
                            Button("Choose YouTube audience") { openSettings(.youtube) }
                                .buttonStyle(EditorGhostButtonStyle(size: .small))
                        }
                        if chosen.contains(.tiktok) {
                            if tiktok.review(caption: captions.caption(for: .tiktok).rendered).ready {
                                Text("TikTok · \(tiktok.mode == .inbox ? "Inbox draft" : tiktok.audienceLabel)")
                                    .font(.studioLabel).foregroundStyle(.secondary)
                            } else {
                                Button("Review TikTok audience and posting options") { openSettings(.tiktok) }
                                    .buttonStyle(EditorGhostButtonStyle(size: .small))
                            }
                        }
                    }
                    if chosen.contains(.tiktok), cover.image != nil, tiktok.mode == .direct {
                        Text(cover.frameImage == nil
                             ? "TikTok uses the video’s default frame."
                             : cover.hasHeadline || cover.source != .frame
                             ? "TikTok uses the selected video frame without custom cover art or text."
                             : "TikTok uses the selected video frame.")
                            .font(.studioLabel).foregroundStyle(.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                .disabled(busy || finished || retrying)
            }
            PosterComposerRow(label: "Caption") {
                PosterCaptionWriter(video: video, chosen: chosenSet, drafts: drafts, generator: generator)
                    .disabled(busy || finished || retrying)
            }
            if chosen.contains(.youtube) {
                PosterComposerRow(label: "YouTube title") {
                    TextField("Add a title", text: Binding(get: { drafts.title(video) }, set: { drafts.setTitle($0, for: video) }))
                        .textFieldStyle(.native)
                        .accessibilityLabel("YouTube title")
                        .disabled(busy || finished || retrying)
                }
            }
            if gate.youtubeDescriptionTooLong {
                Text("Shorten the YouTube description to 5,000 bytes or fewer.")
                    .font(.studioLabel).foregroundStyle(Color.studioDanger).padding(.top, 12)
            }
            PosterOutcomeList(outcomes: session.outcomes)
                .padding(.top, session.outcomes.isEmpty ? 0 : 12)
            HStack(alignment: .top, spacing: 16) {
                if schedule.saved || (!chosen.isEmpty && !finished && !retrying) {
                    PosterWhenPicker(model: schedule, tiktokInbox: chosen.contains(.tiktok) && tiktok.mode == .inbox) {
                        StudioNavigation.shared.goTo(.calendar)
                    }
                }
                PosterPublishBar(
                    label: label(remaining: remaining, later: later, retrying: retrying),
                    busy: busy, canSend: gate.canSend, finished: finished,
                    failures: chosen.filter { drafts.outcome(video, $0)?.status == .failed }.count,
                    waiting: video.readyToPublish ? gate.waiting.map(\.label) : [],
                    tiktokChosen: false,
                    onSend: { send(to: remaining, captions: captions, cover: cover, later: later) },
                    onNext: next
                )
            }
            .padding(.top, 12)
        }
        .onChange(of: busy, initial: true) { _, value in locked = value }
        .task { if schedule.enabled == nil { await schedule.load() } }
        .sheet(isPresented: $showSettings) {
            platformSettings(chosen)
        }
    }

    private func openSettings(_ platform: PublishPlatform? = nil) {
        if let platform { settingsPlatform = platform }
        showSettings = true
    }

    private func platformSettings(_ chosen: [PublishPlatform]) -> some View {
        let current = settingsPlatform.flatMap { chosen.contains($0) ? $0 : nil } ?? chosen.first
        return VStack(alignment: .leading, spacing: 0) {
            Text("Posting settings").font(.nativePageTitle).padding(20)
            Divider()
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 8) {
                    ForEach(chosen) { platform in
                        Button(platform.label) { settingsPlatform = platform }
                            .buttonStyle(EditorSecondaryButtonStyle(size: .small))
                            .accessibilityAddTraits(current == platform ? .isSelected : [])
                            .foregroundStyle(current == platform ? Color.studioAccent : Color.primary)
                    }
                }
                Divider()
                ScrollView {
                    VStack(alignment: .leading, spacing: 12) {
                        if current == .youtube { PosterYouTubeSettingsView(settings: $session.youtube) }
                        if current == .tiktok { PosterTikTokSettingsView(model: tiktok, video: video) }
                        if let current {
                            Text(current == .youtube ? "YouTube description" : "\(current.label) caption")
                                .font(.nativeSectionTitle)
                            NativeTextArea(text: Binding(get: { drafts.override(current, for: video) }, set: {
                                drafts.setOverride($0, for: current, video: video)
                            }), placeholder: "Uses the shared caption", font: .studioBody, minHeight: 72)
                                .accessibilityLabel(current == .youtube ? "YouTube description" : "\(current.label) caption")
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            .padding(20)
            Divider()
            HStack {
                Spacer()
                Button("Done") { showSettings = false }.buttonStyle(EditorPrimaryButtonStyle()).keyboardShortcut(.defaultAction)
            }
            .padding(16)
        }
        .frame(width: 510, height: 540)
        .background(Color.editorBackground)
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
        if remaining.count == 1, let platform = remaining.first { return "Publish to \(platform.label)" }
        return remaining.isEmpty ? "Publish" : "Publish to \(remaining.count) accounts"
    }

    private var preparationLabel: String {
        if video.needsOriginal { return "Attach the original video first" }
        if case let .project(listing) = video.origin,
           let status = projectPreparation.status[listing.summary.id] { return status }
        return "Preparing video…"
    }

    /// One press: prepare the video, then send it everywhere still to go, or
    /// save it to send later.
    private func send(to remaining: [PublishPlatform], captions: PosterCaptionSet, cover: PosterCoverDraft, later: Bool) {
        guard session.begin() else { return }
        Task {
            defer { session.end() }
            guard let target = await prep.prepare(video, cover: cover, captions: captions, destinations: Set(remaining)) else { return }
            let copy = target.copy(for: .tiktok)
            let review = remaining.contains(.tiktok) ? tiktok.review(caption: copy.body.isEmpty ? copy.title : copy.body) : nil
            if later {
                guard await schedule.schedule([target], to: remaining, youtube: session.youtube, tiktok: review, connections: connections) else { return }
                for platform in remaining {
                    drafts.record(PosterOutcome(videoID: target.id, videoTitle: target.title, platform: platform, status: .scheduled))
                }
            } else {
                await session.publish(target, to: remaining, tiktok: review, connections: connections, drafts: drafts)
            }
        }
    }

    private func next() {
        PosterBench.shared.close()
        Task { await PosterLibraryStore.shared.refresh() }
    }
}
