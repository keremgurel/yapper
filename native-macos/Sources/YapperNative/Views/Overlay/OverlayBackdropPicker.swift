import SwiftUI

/// What sits behind the selected card: none, the speaker frosted, or one of
/// the generated presets, as one row of small pictures of each.
///
/// Pictures rather than names, because the names say little and the choice
/// is visual. The pick also becomes the default for the next overlay added,
/// so a whole video takes one click.
struct OverlayBackdropPicker: View {
    @ObservedObject var session: EditorSession
    let overlay: ProjectOverlay

    private var choices: [OverlayBackdrop?] {
        [nil, .frosted] + BackdropPreset.allCases.map { .preset($0) }
    }

    /// A frame of the speaker, for the frosted swatch: the real picture,
    /// blurred, is what frosted will look like.
    private var speakerFrame: CGImage? {
        session.project.clips.first.flatMap { session.thumbnailsByMedia[$0.mediaID]?.first }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                ForEach(Array(choices.enumerated()), id: \.offset) { _, choice in
                    BackdropSwatch(name: name(of: choice), selected: choice == overlay.backdrop) {
                        session.setOverlayBackdrop(overlay, to: choice)
                    } picture: {
                        picture(of: choice)
                    }
                }
            }
            Text(summary)
                .font(.studioCaption)
                .foregroundStyle(.secondary)
                .lineLimit(1)
        }
    }

    private var summary: String {
        guard let backdrop = overlay.backdrop, backdrop.isDrawable else {
            return "Nothing behind the card"
        }
        if OverlayFrame.isFullFrame(overlay) {
            return "Hidden while the overlay fills the frame"
        }
        switch backdrop.kind {
        case .frosted: return "Frosted: your picture, blurred and dimmed"
        case .preset: return "\(backdrop.preset?.title ?? "Preset"), fades in with the card"
        }
    }

    private func name(of choice: OverlayBackdrop?) -> String {
        guard let choice else { return "None" }
        switch choice.kind {
        case .frosted: return "Frosted"
        case .preset: return choice.preset?.title ?? "Preset"
        }
    }

    @ViewBuilder
    private func picture(of choice: OverlayBackdrop?) -> some View {
        switch choice?.kind {
        case nil:
            ZStack {
                Color.studioInputBackground
                Image(systemName: "circle.slash")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(.secondary)
            }
        case .frosted:
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
        case .preset:
            if let preset = choice?.preset { BackdropPresetPicture(preset: preset) } else { Color.black }
        }
    }
}
