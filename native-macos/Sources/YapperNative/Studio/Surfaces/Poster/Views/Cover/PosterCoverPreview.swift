import AppKit
import SwiftUI

/// The thumbnail exactly as it ships, headline included, with the ways to
/// change where it comes from.
struct PosterCoverPreview: View {
    let draft: PosterCoverDraft
    let originalAvailable: Bool
    let busy: Bool
    let onChange: (PosterCoverDraft) -> Void
    @State private var uploadError: String?
    @State private var rendered: CGImage?

    var body: some View {
        VStack(spacing: 10) {
            ZStack {
                Rectangle().fill(Color.studioInputBackground)
                if let rendered {
                    Image(decorative: rendered, scale: 1).resizable().scaledToFit()
                } else {
                    Text("Pick a frame").font(.system(size: 12)).foregroundStyle(.secondary)
                }
            }
            .aspectRatio(9 / 16, contentMode: .fit)
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            .task(id: signature) { rendered = PosterCoverRenderer.render(draft) }

            HStack(spacing: 6) {
                if draft.source != .frame && draft.frameImage != nil {
                    Button("Use frame") {
                        var next = draft
                        next.image = draft.frameImage
                        next.source = .frame
                        onChange(next)
                    }
                    .buttonStyle(EditorGhostButtonStyle(size: .small))
                }
                Button("Download", systemImage: "arrow.down.to.line") { download() }
                    .buttonStyle(EditorGhostButtonStyle(size: .small))
                    .disabled(draft.image == nil)
            }

            Button(draft.source == .uploaded ? "Replace thumbnail" : "Upload thumbnail", systemImage: "square.and.arrow.up") {
                upload()
            }
            .buttonStyle(EditorSecondaryButtonStyle(size: .small))
            .disabled(busy)
            if let uploadError {
                Text(uploadError).font(.system(size: 12)).foregroundStyle(NativeChip.Tone.yellow.color)
            }
            Text("JPG, PNG, WebP. Up to 20 MB. 9:16 works best.")
                .font(.system(size: 11)).foregroundStyle(.secondary).multilineTextAlignment(.center)
        }
    }

    /// Only what changes the pixels, so editing a caption never redraws the cover.
    private var signature: [AnyHashable] {
        [draft.image.map(ObjectIdentifier.init), draft.hasHeadline ? draft.headline : "", draft.textStyle, draft.position]
    }

    private func upload() {
        guard let url = PosterImageData.chooseImage(title: "Choose a thumbnail") else { return }
        switch PosterImageData.coverImage(at: url) {
        case let .success(image):
            uploadError = nil
            var next = draft
            next.image = image
            next.source = .uploaded
            onChange(next)
        case let .failure(message):
            uploadError = message.text
        }
    }

    private func download() {
        guard let png = PosterCoverRenderer.png(draft) else { return }
        let panel = NSSavePanel()
        panel.nameFieldStringValue = "yapper-thumbnail.png"
        panel.allowedContentTypes = [.png]
        guard panel.runModal() == .OK, let url = panel.url else { return }
        try? png.write(to: url)
    }
}
