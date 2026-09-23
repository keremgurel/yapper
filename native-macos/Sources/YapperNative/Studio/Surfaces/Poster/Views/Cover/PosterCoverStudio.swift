import CoreGraphics
import SwiftUI

/// The thumbnail. The frame under the playhead is the cover, live: picking a
/// frame changes it and there is nothing to press. The source video and the
/// cover sit side by side so the creator sees what they picked next to what
/// ships. Remixing with AI and adding text are folded steps below.
struct PosterCoverStudio: View {
    let video: PosterVideo
    @ObservedObject var drafts: PosterDraftStore
    @Binding var framePending: Bool
    @StateObject private var picker = PosterFramePicker()
    @StateObject private var remix = PosterRemixModel()
    @State private var original: CGImage?

    private var draft: PosterCoverDraft { drafts.cover(video) }

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            HStack(alignment: .top, spacing: 20) {
                pane("Pick the frame") {
                    PosterFramePlayer(url: picker.videoURL, time: picker.time)
                }
                pane("Your thumbnail") {
                    PosterCoverPreview(draft: draft, originalAvailable: original != nil, busy: remix.generating) { update($0) }
                    if let original, draft.source != .original {
                        Button("Use original Instagram thumbnail") {
                            var next = draft
                            next.image = original
                            next.source = .original
                            update(next)
                        }
                        .buttonStyle(EditorGhostButtonStyle(size: .small))
                    }
                }
            }

            PosterFramePickerView(picker: picker)

            PosterDisclosure(title: "Remix with AI", meta: draft.source == .generated ? "In use" : "2 credits") {
                PosterRemixPanel(remix: remix, frame: draft.frameImage) {
                    Task {
                        if let image = await remix.generate(frame: draft.frameImage) {
                            var next = draft
                            next.image = image
                            next.source = .generated
                            update(next)
                        }
                    }
                }
            }

            PosterDisclosure(title: "Text on the thumbnail", meta: draft.hasHeadline ? "On" : "Off") {
                PosterTextOverlayPanel(draft: draft) { update($0) }
            }
        }
        .task(id: video.id) {
            let untouched = !drafts.hasCover(video)
            picker.onFrame = { [drafts, video] image, time in
                drafts.setCover(drafts.cover(video).withFrame(image, at: time), for: video)
            }
            async let frames: Void = picker.load(video.media, initialTime: draft.frameImage == nil ? 1 : draft.frameTime)
            async let cover: Void = loadOriginal(applying: untouched)
            _ = await (frames, cover)
        }
        .onChange(of: picker.busy || picker.error != nil) { _, pending in
            framePending = draft.source == .frame && pending
        }
        .onDisappear { framePending = false }
    }

    private func update(_ next: PosterCoverDraft) { drafts.setCover(next, for: video) }

    private func pane<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title).font(.system(size: 13, weight: .semibold)).foregroundStyle(.secondary)
            VStack(spacing: 10) { content() }
        }
        .frame(maxWidth: 280)
        .frame(maxWidth: .infinity)
    }

    /// An Instagram post starts from its own cover, as it does on the web.
    private func loadOriginal(applying: Bool) async {
        guard let path = video.originalThumbnailPath,
              let data = try? await PosterHTTP.bytes(path),
              let image = PosterImageData.image(from: data)
        else { return }
        original = image
        if applying, draft.source == .frame {
            var next = draft
            next.image = image
            next.source = .original
            update(next)
        }
    }
}
