import SwiftUI

/// Uses the same inspector sections and the same text model as Studio hooks.
struct PosterTextOverlayPanel: View {
    @Binding var draft: PosterCoverDraft

    private var editor: TextStyleEditor {
        TextStyleEditor(style: draft.textStyle, defaults: PosterCoverDraft.coverTextStyle,
                        fontScaleRange: TextAppearance.layerFontScaleRange) { patch, _ in
            draft.textStyle.apply(patch)
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            VStack(alignment: .leading, spacing: 10) {
                NativeTextArea(text: Binding(get: { draft.headline }, set: {
                    draft.headline = String($0.prefix(100))
                    draft.showHeadline = !draft.headline.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                }), placeholder: "Write a short hook…", font: .system(size: 14), minHeight: 60)
                .accessibilityLabel("Cover text")
                InspectorRow("Look", alignment: .top) {
                    InspectorLookRail(
                        templates: TextTemplate.all,
                        selection: TextTemplate.all.first { $0.matches(editor.appearance) }?.id,
                        onSelect: { draft.textStyle.appearance = $0.applied(to: draft.textStyle.appearance) }
                    )
                }
                InspectorRow("Font") {
                    InspectorSegmentedControl(
                        options: TextLayerFont.allCases.map { .init(value: $0, label: $0.title, font: $0.previewFont()) },
                        selection: editor.appearance.font, onSelect: { editor.set(TextStylePatch(font: $0)) }
                    )
                }
                InspectorRow("Size") {
                    InspectorSlider(value: editor.displaySize, range: editor.displaySizeRange,
                                    onChange: { editor.set(TextStylePatch(fontScale: $0 / 1000), live: true) })
                }
                InspectorRow("Fill") {
                    InspectorColorWell(color: editor.appearance.color) { color, live in
                        editor.set(TextStylePatch(color: color), live: live)
                    }
                }
            }
            .padding(.bottom, 12)
            Divider()
            AppearancePositionSection(editor: editor)
            Divider()
            AppearanceStrokeSection(editor: editor)
            Divider()
            AppearanceBackgroundSection(editor: editor)
            Divider()
            AppearanceShadowSection(editor: editor)
        }
    }
}
