import SwiftUI

struct PosterCaptionWriter: View {
    let video: PosterVideo
    let chosen: Set<PublishPlatform>
    @ObservedObject var drafts: PosterDraftStore
    @ObservedObject var generator: PosterCaptionGenerator

    var body: some View {
        let shared = drafts.sharedCaption(video)
        VStack(alignment: .leading, spacing: 8) {
            NativeTextArea(text: Binding(get: { drafts.sharedCaption(video) }, set: { drafts.setSharedCaption($0, for: video) }),
                           placeholder: "Write a caption…", font: .studioBody, minHeight: 92)
                .accessibilityLabel("Caption")
            HStack(spacing: 8) {
                if drafts.canUndoGeneration(video) {
                    Button("Undo generation") { drafts.undoGeneration(video) }
                        .buttonStyle(EditorGhostButtonStyle(size: .small))
                } else if !shared.isEmpty, shared == video.sourceCaption {
                    Text("From your original post").font(.studioLabel).foregroundStyle(.secondary)
                }
                Spacer()
                Button {
                    guard let platform = chosen.contains(.youtube) ? .youtube : PublishPlatform.enabledCases.first(where: chosen.contains) else { return }
                    Task {
                        await generator.generate(for: video, platforms: [platform], brief: drafts.brief(video), titleOnly: false,
                                                 into: drafts, reference: shared, shared: true)
                    }
                } label: {
                    HStack(spacing: 6) {
                        if generator.generating { ProgressView().controlSize(.mini) }
                        Text(generator.reading ? "Reading video…" : generator.generating ? "Writing…" :
                             chosen.contains(.youtube) ? "Generate title and captions" : "Generate captions")
                    }
                }
                .buttonStyle(EditorSecondaryButtonStyle(size: .small))
                .disabled(chosen.isEmpty || generator.generating || (!video.readyToPublish && shared.isEmpty && drafts.description(video).isEmpty))
            }
            if generator.errorVideoID == video.id, let error = generator.error {
                Text(error).font(.studioLabel).foregroundStyle(Color.studioDanger)
            }
            if video.noSpeech || (generator.errorVideoID == video.id && generator.error != nil) {
                NativeTextArea(text: Binding(get: { drafts.description(video) }, set: { drafts.setDescription(String($0.prefix(2000)), for: video) }),
                               placeholder: "Describe the video to generate copy", font: .studioBody, minHeight: 56)
                    .accessibilityLabel("Video description")
            }
        }
    }
}
