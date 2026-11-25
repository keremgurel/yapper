import SwiftUI

/// Everything past the look and the five quick settings: the font itself,
/// then stroke, background, shadow, width and angle. Folded away until asked
/// for, because most captions never need it.
struct CaptionMoreStyling: View {
    let editor: TextStyleEditor
    var body: some View {
        InspectorFoldSection("More styling", id: "captions.more", summary: "Font, outline, box, shadow", openByDefault: false) {
            VStack(alignment: .leading, spacing: 0) {
                CaptionFontGrid(selection: editor.appearance.font) { editor.set(TextStylePatch(font: $0)) }
                    .padding(.bottom, 10)
                Divider().opacity(0.45)
                AppearancePositionSection(editor: editor, showsCoordinates: false)
                Divider().opacity(0.45)
                AppearanceStrokeSection(editor: editor)
                Divider().opacity(0.45)
                AppearanceBackgroundSection(editor: editor)
                Divider().opacity(0.45)
                AppearanceShadowSection(editor: editor)
            }
        }
    }
}

/// The nine faces, each set in itself.
private struct CaptionFontGrid: View {
    let selection: TextLayerFont
    let onSelect: (TextLayerFont) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Font").font(.studioLabel).foregroundStyle(Color.studioTextMuted)
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 88), spacing: 8)], spacing: 8) {
                ForEach(TextLayerFont.allCases) { font in
                    let isOn = font == selection
                    Button { onSelect(font) } label: {
                        VStack(spacing: 3) {
                            Text("Aa").font(font.previewFont(size: 17))
                            Text(font.title).font(.studioCaption).foregroundStyle(Color.studioTextMuted)
                        }
                        .frame(maxWidth: .infinity)
                        .frame(height: 52)
                        .background(isOn ? Color.studioSelectedFill : Color.studioFaintFill,
                                    in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                        .overlay {
                            RoundedRectangle(cornerRadius: 8, style: .continuous)
                                .strokeBorder(isOn ? Color.studioAccent : Color.studioLine, lineWidth: isOn ? 1.5 : 0.5)
                        }
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.studioPlain)
                    .accessibilityLabel(font.title)
                    .accessibilityAddTraits(isOn ? .isSelected : [])
                }
            }
        }
    }
}
