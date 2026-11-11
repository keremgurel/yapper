import AppKit
import SwiftUI

/// Frame choice and text edits are staged locally until Apply cover.
struct PosterCoverStudio: View {
    let video: PosterVideo
    let onApply: (PosterCoverDraft) -> Void
    @State private var draft: PosterCoverDraft
    @Environment(\.dismiss) private var dismiss
    @StateObject private var picker = PosterFramePicker()
    @StateObject private var remix = PosterRemixModel()
    @State private var original: CGImage?
    @State private var candidate: CGImage?
    @State private var uploadError: String?
    @State private var tab = Tab.frame

    enum Tab: String, CaseIterable { case frame = "Frame", text = "Text", ai = "AI" }

    init(video: PosterVideo, initial: PosterCoverDraft, onApply: @escaping (PosterCoverDraft) -> Void) {
        self.video = video
        self.onApply = onApply
        _draft = State(initialValue: initial)
    }

    private var pending: Bool { draft.source == .frame && picker.busy }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Edit cover").font(.nativePageTitle).padding(20)
            Divider()
            HStack(alignment: .top, spacing: 20) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Cover preview").font(.nativeSectionTitle)
                    PosterCoverPreview(draft: draft)
                    Text("9:16 · 1080 × 1920").font(.system(size: 12)).foregroundStyle(.secondary)
                }
                .frame(width: 188)
                VStack(alignment: .leading, spacing: 12) {
                    NativeSegmented(options: Tab.allCases.map { .init(value: $0, label: $0.rawValue) }, selection: $tab)
                    Divider()
                    ScrollView {
                        VStack(alignment: .leading, spacing: 12) {
                            switch tab {
                            case .frame: frameTools
                            case .text: PosterTextOverlayPanel(draft: $draft)
                            case .ai: aiTools
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .topLeading)
                    }
                }
            }
            .padding(20)
            .frame(maxHeight: .infinity, alignment: .top)
            Divider()
            HStack(spacing: 8) {
                Spacer()
                Button("Cancel") { dismiss() }.buttonStyle(EditorSecondaryButtonStyle()).keyboardShortcut(.cancelAction)
                Button("Apply cover") {
                    onApply(draft)
                    dismiss()
                }
                .buttonStyle(EditorPrimaryButtonStyle())
                .disabled(draft.image == nil || pending)
            }
            .padding(16)
        }
        .frame(width: 720, height: 570)
        .background(Color.editorBackground)
        .task(id: video.media) {
            picker.onFrame = { image, time in draft = draft.withFrame(image, at: time) }
            async let frames: Void = picker.load(video.media, initialTime: draft.frameImage == nil ? 1 : draft.frameTime)
            async let cover: Void = loadOriginal()
            _ = await (frames, cover)
        }
    }

    private var frameTools: some View {
        VStack(alignment: .leading, spacing: 12) {
            PosterFramePickerView(picker: picker) {
                if draft.source != .frame {
                    draft.image = draft.frameImage
                    draft.source = .frame
                }
            }
            ViewThatFits(in: .horizontal) {
                HStack(spacing: 8) { frameActions }
                VStack(alignment: .leading, spacing: 8) { frameActions }
            }
            if let uploadError {
                Text(uploadError).font(.system(size: 12)).foregroundStyle(Color.studioDanger)
            }
        }
    }

    @ViewBuilder
    private var frameActions: some View {
        if draft.source != .frame, let frame = draft.frameImage {
            Button("Use selected frame") { use(frame, source: .frame) }
                .buttonStyle(EditorSecondaryButtonStyle(size: .small))
        }
        if let original, draft.source != .original {
            Button("Use original cover") { use(original, source: .original) }
                .buttonStyle(EditorSecondaryButtonStyle(size: .small))
        }
        Button("Upload image") { upload() }.buttonStyle(EditorSecondaryButtonStyle(size: .small))
        Button("Download cover") { download() }.buttonStyle(EditorGhostButtonStyle(size: .small))
            .disabled(draft.image == nil || pending)
    }

    private var aiTools: some View {
        VStack(alignment: .leading, spacing: 12) {
            PosterRemixPanel(remix: remix, frame: draft.frameImage) {
                Task { candidate = await remix.generate(frame: draft.frameImage) }
            }
            if let candidate {
                HStack(alignment: .bottom, spacing: 12) {
                    Image(decorative: candidate, scale: 1).resizable().scaledToFit().frame(width: 74)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                    Button("Use this image") {
                        use(candidate, source: .generated)
                        self.candidate = nil
                    }
                    .buttonStyle(EditorSecondaryButtonStyle(size: .small))
                }
            }
        }
    }

    private func use(_ image: CGImage, source: PosterCoverDraft.Source) {
        draft.image = image
        draft.source = source
    }

    private func loadOriginal() async {
        guard let path = video.originalThumbnailPath,
              let data = try? await PosterHTTP.bytes(path),
              let image = PosterImageData.image(from: data),
              !Task.isCancelled else { return }
        original = image
        if draft.source == .frame, draft.frameImage == nil { use(image, source: .original) }
    }

    private func upload() {
        guard let url = PosterImageData.chooseImage(title: "Choose a cover image") else { return }
        switch PosterImageData.coverImage(at: url) {
        case let .success(image):
            uploadError = nil
            use(image, source: .uploaded)
        case let .failure(message): uploadError = message.text
        }
    }

    private func download() {
        guard let png = PosterCoverRenderer.png(draft) else { return }
        let panel = NSSavePanel()
        panel.nameFieldStringValue = "yapper-cover.png"
        panel.allowedContentTypes = [.png]
        guard panel.runModal() == .OK, let url = panel.url else { return }
        do { try png.write(to: url) }
        catch { uploadError = "The cover couldn’t be downloaded." }
    }
}
