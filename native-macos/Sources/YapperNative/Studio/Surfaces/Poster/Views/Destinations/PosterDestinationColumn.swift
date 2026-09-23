import SwiftUI

/// Everywhere this video is going and whether each place can take it: the
/// destinations, the caption writer, one card per destination, and the one
/// publish button that counts them.
struct PosterDestinationColumn: View {
    let video: PosterVideo
    let framePending: Bool
    @ObservedObject var drafts: PosterDraftStore
    @ObservedObject var connections: PosterConnectionStore
    @ObservedObject var generator: PosterCaptionGenerator
    @ObservedObject var prep: PosterPublishPrep

    var body: some View {
        let connected = connections.connected
        let chosen = drafts.destinations(video, connected: connected)
        let captions = drafts.captions(video)
        let cover = drafts.cover(video)
        let readiness = PublishPlatform.allCases.filter(chosen.contains).map { platform in
            PosterReadiness(platform: platform, connected: connected.contains(platform), caption: captions.caption(for: platform),
                            hasCover: cover.image != nil, outcome: drafts.outcome(video, platform))
        }
        let summary = PosterPublishSummary(readiness)

        VStack(alignment: .leading, spacing: 14) {
            PosterDestinationToggles(
                chosen: chosen, connected: connected,
                onToggle: { drafts.toggle($0, for: video, connected: connected) },
                onConnect: connections.connect
            )
            if chosen.isEmpty {
                Text("Choose at least one destination.").font(.system(size: 13)).foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity)
            } else {
                writer(chosen: chosen)
            }
            ForEach(readiness, id: \.platform) { item in
                PosterDestinationCard(
                    readiness: item, caption: captions.caption(for: item.platform),
                    sending: prep.preparing && item.state == .ready,
                    onChange: { drafts.setCaption($0, for: video) },
                    onRemove: { drafts.toggle(item.platform, for: video, connected: connected) }
                )
            }
            if !chosen.isEmpty {
                VStack(spacing: 8) {
                    Button { publish(chosen: chosen, captions: captions, cover: cover) } label: {
                        HStack(spacing: 6) {
                            if prep.preparing { ProgressView().controlSize(.mini) }
                            Text(prep.preparing ? "Preparing" : framePending ? "Preparing thumbnail" : summary.label)
                        }
                        .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(EditorPrimaryButtonStyle())
                    .disabled(!summary.canPublish || prep.preparing || framePending)
                    if summary.blocked > 0 {
                        Text("\(summary.blocked) \(summary.blocked == 1 ? "needs" : "need") a fix first")
                            .font(.system(size: 12)).foregroundStyle(.secondary)
                    }
                }
                .nativeCard(padding: 12, radius: 12)
            }
            PosterCaptionBriefView(value: drafts.brief(video), disabled: generator.generating) {
                drafts.setBrief($0, for: video)
            }
        }
    }

    @ViewBuilder
    private func writer(chosen: Set<PublishPlatform>) -> some View {
        let hasOriginal = !(video.sourceCaption ?? "").isEmpty
        let reading = generator.reading || video.transcriptStatus == "pending"
        VStack(alignment: .leading, spacing: 8) {
            if hasOriginal {
                Text("Starts with your original caption.").font(.system(size: 12)).foregroundStyle(.secondary)
                HStack(spacing: 8) {
                    Button("Use original caption") { drafts.useOriginalCaption(for: video) }
                        .buttonStyle(EditorGhostButtonStyle(size: .small))
                        .disabled(generator.generating)
                    if chosen.contains(.youtube) {
                        Button("Generate YouTube title", systemImage: "sparkles") { generate([.youtube], titleOnly: true) }
                            .buttonStyle(EditorSecondaryButtonStyle(size: .small))
                            .disabled(generator.generating || reading)
                    }
                }
            }
            Button { generate(PublishPlatform.allCases.filter(chosen.contains), titleOnly: false) } label: {
                HStack(spacing: 6) {
                    if generator.generating || reading { ProgressView().controlSize(.mini) } else { Image(systemName: "sparkles") }
                    Text(reading ? "Reading what the video says" : generator.generating ? "Writing"
                         : hasOriginal ? "Rewrite the captions" : "Write the captions")
                }
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(EditorSecondaryButtonStyle())
            .disabled(generator.generating || reading)
            Label(source(hasOriginal: hasOriginal, reading: reading),
                  systemImage: video.transcriptStatus == "ready" ? "checkmark.circle" : "waveform")
                .font(.system(size: 12)).foregroundStyle(.secondary)
                .frame(maxWidth: .infinity)
            if let error = generator.error {
                Text(error).font(.system(size: 12)).foregroundStyle(NativeChip.Tone.yellow.color)
            }
        }
    }

    private func source(hasOriginal: Bool, reading: Bool) -> String {
        if video.transcriptStatus == "ready" { return "From the video's transcript, one per platform" }
        if reading { return "Transcript is being prepared" }
        return hasOriginal ? "Generation reads the video transcript first" : "From the title and your caption prompt"
    }

    private func generate(_ platforms: [PublishPlatform], titleOnly: Bool) {
        Task {
            await generator.generate(for: video, platforms: platforms, brief: drafts.brief(video), titleOnly: titleOnly, into: drafts)
        }
    }

    private func publish(chosen: Set<PublishPlatform>, captions: PosterCaptionSet, cover: PosterCoverDraft) {
        Task { await prep.prepare(video, cover: cover, captions: captions, destinations: chosen) }
    }
}
