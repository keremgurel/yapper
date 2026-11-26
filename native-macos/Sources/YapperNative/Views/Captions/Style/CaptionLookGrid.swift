import SwiftUI

/// Every caption look, drawn on a frame of the creator's own take with their
/// own words, so picking one is picking what they will see.
struct CaptionLookGrid: View {
    @ObservedObject var session: EditorSession
    let current: TextAppearance
    let onSelect: (TextTemplate) -> Void

    private var sample: String {
        let first = session.project.storedCaptions.first.map { session.captionTexts[$0.id] ?? $0.text }
        let words = (first ?? "Your words here").split(separator: " ").prefix(3).joined(separator: " ")
        return words.isEmpty ? "Your words here" : words
    }

    private var frame: CGImage? {
        guard let clip = session.project.clips.first else { return nil }
        return session.thumbnailsByMedia[clip.mediaID]?.first
    }

    var body: some View {
        // Two rows that scroll sideways: every look within a swipe, and the
        // settings under it stay where they are.
        ScrollView(.horizontal, showsIndicators: false) {
            LazyHGrid(rows: Array(repeating: GridItem(.fixed(90), spacing: 10), count: 2), spacing: 8) {
                ForEach(TextTemplate.all) { template in
                    CaptionLookTile(
                        template: template,
                        look: template.applied(to: current),
                        sample: sample,
                        frame: frame,
                        isSelected: template.matches(current)
                    ) { onSelect(template) }
                    .frame(width: 112)
                }
            }
            .padding(.vertical, 3)
        }
        .padding(.vertical, -3)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Caption looks")
    }
}

private struct CaptionLookTile: View {
    let template: TextTemplate
    let look: TextAppearance
    let sample: String
    let frame: CGImage?
    let isSelected: Bool
    let action: () -> Void

    @State private var isHovering = false
    private let shape = RoundedRectangle(cornerRadius: 9, style: .continuous)

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 5) {
                ZStack {
                    Color.previewWorkspaceBackground
                    if let frame {
                        Image(decorative: frame, scale: 1).resizable().scaledToFill()
                            .overlay(Color.black.opacity(0.28))
                    }
                    AppearanceText(text: sample, appearance: look, fontSize: 12, lineLimit: 2, minimumScaleFactor: 0.6)
                        .padding(.horizontal, 6)
                }
                .frame(height: 62)
                .frame(maxWidth: .infinity)
                .clipShape(shape)
                .overlay { shape.strokeBorder(Color.studioLine, lineWidth: 0.5) }
                .overlay {
                    if isSelected { shape.inset(by: -2.5).strokeBorder(Color.studioAccent, lineWidth: 1.5) }
                }
                .scaleEffect(isHovering && !isSelected ? 1.02 : 1)
                .animation(.easeOut(duration: 0.12), value: isHovering)
                Text(template.name)
                    .font(isSelected ? .studioCaptionStrong : .studioCaption)
                    .foregroundStyle(isSelected ? Color.primary : Color.studioTextMuted)
                    .lineLimit(1)
            }
            .padding(2.5)
            .contentShape(Rectangle())
        }
        .buttonStyle(.studioPlain)
        .onHover { isHovering = $0 }
        .help("Use the \(template.name) look. Size and case stay as they are.")
        .accessibilityLabel(template.name)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}
