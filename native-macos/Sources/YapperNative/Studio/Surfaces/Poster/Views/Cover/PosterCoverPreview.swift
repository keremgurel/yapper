import SwiftUI

/// Preview uses the very same renderer as the exported cover.
struct PosterCoverPreview: View {
    let draft: PosterCoverDraft
    var compact = false
    @State private var rendered: CGImage?

    private struct Signature: Equatable {
        let image: ObjectIdentifier?
        let text: String
        let style: TextStyle
    }

    var body: some View {
        Rectangle().fill(Color.studioInputBackground)
            .aspectRatio(9.0 / 16.0, contentMode: .fit)
            .overlay {
                if let rendered {
                    Image(decorative: rendered, scale: 1).resizable().scaledToFit()
                } else if !compact {
                    Text("Pick a frame").font(.studioLabel).foregroundStyle(.secondary)
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: compact ? 5 : 9))
            .accessibilityLabel("Cover preview")
            .task(id: Signature(image: draft.image.map(ObjectIdentifier.init), text: draft.hasHeadline ? draft.headline : "", style: draft.textStyle)) {
                rendered = PosterCoverRenderer.render(draft, size: compact ? CGSize(width: 108, height: 192) : CGSize(width: 540, height: 960))
            }
    }
}
