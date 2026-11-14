import AppKit
import SwiftUI
import UniformTypeIdentifiers

/// What sits behind the selected card: none, the speaker frosted, a picture
/// (imported or generated from a sentence), or one of the generated presets,
/// as one row of small pictures of each.
///
/// Pictures rather than names, because the choice is visual. The pick also
/// becomes the default for the next overlay added, so a whole video takes one
/// click.
struct OverlayBackdropPicker: View {
    @ObservedObject var session: EditorSession
    let overlay: ProjectOverlay

    @State private var showsGenerate = false

    private var backdrop: OverlayBackdrop? { overlay.backdrop }

    /// A frame of the speaker, for the frosted swatch: the real picture,
    /// blurred, is what frosted will look like.
    private var speakerFrame: CGImage? {
        session.project.clips.first.flatMap { session.thumbnailsByMedia[$0.mediaID]?.first }
    }

    private var picture: CGImage? {
        guard let id = backdrop?.mediaID else { return nil }
        if let thumbnail = session.thumbnailsByMedia[id]?.first { return thumbnail }
        return session.project.media.first { $0.id == id }
            .flatMap { NSImage(contentsOf: $0.url)?.cgImage(forProposedRect: nil, context: nil, hints: nil) }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            LazyVGrid(columns: BackdropSwatchGrid.columns, alignment: .leading, spacing: 6) {
                BackdropSwatch(name: "None", selected: backdrop == nil) {
                    guard backdrop != nil else { return }
                    session.setOverlayBackdrop(overlay, to: nil)
                } picture: {
                    iconTile("circle.slash")
                }

                BackdropSwatch(name: "Frosted", selected: backdrop?.kind == .frosted) {
                    guard backdrop?.kind != .frosted else { return }
                    session.setOverlayBackdrop(overlay, to: .frosted)
                } picture: {
                    frostedPicture
                }

                BackdropSwatch(name: "Your image", selected: backdrop?.kind == .image) {
                    chooseImage()
                } picture: {
                    if backdrop?.kind == .image, let picture {
                        Image(decorative: picture, scale: 1).resizable().scaledToFill()
                    } else {
                        iconTile("photo")
                    }
                }

                BackdropSwatch(name: "Generate from a prompt", selected: false) {
                    showsGenerate = true
                } picture: {
                    iconTile("sparkles")
                }
                .popover(isPresented: $showsGenerate, arrowEdge: .bottom) {
                    BackdropPromptForm(session: session, overlay: overlay) { showsGenerate = false }
                }

                ForEach(BackdropPreset.allCases) { preset in
                    let selected = backdrop?.kind == .preset && backdrop?.preset == preset
                    BackdropSwatch(name: preset.title, selected: selected) {
                        // Picking the look already chosen keeps its colours.
                        guard !selected else { return }
                        session.setOverlayBackdrop(overlay, to: .preset(preset))
                    } picture: {
                        BackdropPresetPicture(preset: preset, colors: selected ? backdrop?.colors : nil)
                    }
                }
            }

            Text(summary)
                .font(.studioCaption)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)

            if let backdrop, backdrop.kind == .preset, let preset = backdrop.preset {
                BackdropColorControls(preset: preset, colors: backdrop.colors) { colors in
                    session.setOverlayBackdrop(
                        overlay,
                        to: OverlayBackdrop(kind: .preset, preset: preset, colors: colors.isEmpty ? nil : colors)
                    )
                }
                .padding(.top, 4)
            }
        }
    }

    private var summary: String {
        guard let backdrop, backdrop.isDrawable else {
            return "Nothing behind the card"
        }
        if OverlayFrame.isFullFrame(overlay) {
            return "Hidden while the overlay fills the frame"
        }
        switch backdrop.kind {
        case .frosted:
            return "Frosted: your picture, blurred and dimmed"
        case .preset:
            return "\(backdrop.preset?.title ?? "Preset"), fades in with the card"
        case .image:
            let name = backdrop.mediaID.flatMap { id in session.project.media.first { $0.id == id }?.name } ?? "Picture"
            return "\(name), fills the frame behind the card"
        }
    }

    private var frostedPicture: some View {
        ZStack {
            if let speakerFrame {
                Image(decorative: speakerFrame, scale: 1)
                    .resizable()
                    .scaledToFill()
                    .scaleEffect(1.5)
                    .blur(radius: 3)
                    .brightness(-0.07)
                    .saturation(0.9)
            } else {
                Color.gray.opacity(0.5)
            }
        }
        .clipped()
    }

    private func iconTile(_ symbol: String) -> some View {
        ZStack {
            Color.studioInputBackground
            Image(systemName: symbol)
                .font(.studioLabelStrong)
                .foregroundStyle(.secondary)
        }
    }

    private func chooseImage() {
        let panel = NSOpenPanel()
        panel.allowedContentTypes = [.image]
        panel.allowsMultipleSelection = false
        panel.prompt = "Use as backdrop"
        panel.message = "Choose a picture to fill the frame behind this card"
        guard panel.runModal() == .OK, let url = panel.url else { return }
        let target = overlay
        Task { await session.setOverlayBackdropImage(target, from: url) }
    }
}

/// The popover that turns a sentence into a backdrop picture.
private struct BackdropPromptForm: View {
    @ObservedObject var session: EditorSession
    let overlay: ProjectOverlay
    let done: () -> Void

    @State private var prompt = ""
    @State private var working = false
    @State private var failure: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Generate a background")
                .font(.studioBodyStrong)
            TextField("A dim study with warm lamp light", text: $prompt, axis: .vertical)
                .textFieldStyle(.roundedBorder)
                .lineLimit(2 ... 4)
                .disabled(working)
                .onSubmit(generate)
            Text("Kept dark, soft and free of text so the card and captions stay readable. Uses one AI thumbnail credit.")
                .font(.studioCaption)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
            if let failure {
                Text(failure)
                    .font(.studioCaption)
                    .foregroundStyle(Color.studioDanger)
                    .fixedSize(horizontal: false, vertical: true)
            }
            HStack {
                Spacer()
                Button("Cancel", action: done)
                    .buttonStyle(EditorGhostButtonStyle())
                    .disabled(working)
                Button(working ? "Generating…" : "Generate", action: generate)
                    .buttonStyle(EditorPrimaryButtonStyle(size: .small))
                    .disabled(working || prompt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
        }
        .padding(14)
        .frame(width: 320)
    }

    private func generate() {
        let request = prompt.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !request.isEmpty, !working else { return }
        working = true
        failure = nil
        Task {
            do {
                try await session.generateOverlayBackdrop(overlay, prompt: request)
                working = false
                done()
            } catch {
                working = false
                failure = error.localizedDescription
            }
        }
    }
}
