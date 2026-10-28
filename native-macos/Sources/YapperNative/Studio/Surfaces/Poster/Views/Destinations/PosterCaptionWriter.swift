import SwiftUI

/// Writes every chosen destination's caption in one press. What the video is
/// about is optional context, folded away; the original caption and a
/// YouTube-title-only pass sit beside the button when they apply.
struct PosterCaptionWriter: View {
    let video: PosterVideo
    let chosen: Set<PublishPlatform>
    @ObservedObject var drafts: PosterDraftStore
    @ObservedObject var generator: PosterCaptionGenerator

    var body: some View {
        let hasOriginal = !(video.sourceCaption ?? "").isEmpty
        let hasDescription = !drafts.description(video).trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        let reading = generator.reading || (!hasDescription && (video.transcriptStatus == "pending" || (video.platform != nil && video.mediaKey == nil)))
        VStack(alignment: .leading, spacing: 8) {
            PosterDisclosure(title: "Add context for generation", meta: hasDescription ? "Added" : "Optional") {
                NativeTextArea(text: Binding(get: { drafts.description(video) }, set: { drafts.setDescription(String($0.prefix(2000)), for: video) }),
                               placeholder: "What is this video about? Describe what happens or what you want to say.",
                               font: .system(size: 13), minHeight: 64)
                    .accessibilityLabel("What is this video about? Optional")
            }
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
            Button { generate(PublishPlatform.enabledCases.filter(chosen.contains), titleOnly: false) } label: {
                HStack(spacing: 6) {
                    if generator.generating || reading { ProgressView().controlSize(.mini) } else { Image(systemName: "sparkles") }
                    Text(reading ? "Reading what the video says" : generator.generating ? "Writing"
                         : hasOriginal ? "Rewrite the captions" : "Generate captions")
                }
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(EditorSecondaryButtonStyle())
            .disabled(generator.generating || reading)
            Label(source(hasOriginal: hasOriginal, reading: reading),
                  systemImage: video.transcriptStatus == "ready" ? "checkmark.circle" : "waveform")
                .font(.system(size: 12)).foregroundStyle(.secondary)
                .frame(maxWidth: .infinity)
            if generator.errorVideoID == video.id, let error = generator.error {
                Text(error).font(.system(size: 12)).foregroundStyle(NativeChip.Tone.yellow.color)
            }
        }
    }

    private func source(hasOriginal: Bool, reading: Bool) -> String {
        if video.noSpeech { return "No speech detected. Describe the video or write a caption." }
        if !drafts.description(video).trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { return "From your description" }
        if video.transcriptStatus == "ready" { return "From the video's transcript, one per platform" }
        if reading { return "Transcript is being prepared" }
        return hasOriginal ? "Generation reads the video transcript first" : "From the title and your caption prompt"
    }

    private func generate(_ platforms: [PublishPlatform], titleOnly: Bool) {
        Task {
            await generator.generate(for: video, platforms: platforms, brief: drafts.brief(video), titleOnly: titleOnly, into: drafts, reference: nil)
        }
    }
}
