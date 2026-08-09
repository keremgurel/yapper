import SwiftUI

/// The properties of one text layer, laid out exactly like the caption panel.
///
/// Exactly like it on purpose: the words, the look, the font, the size, the
/// casing and the fill are on screen the moment it opens, and Position, Stroke,
/// Background and Shadow are folded below in that order under those names.
/// Somebody who has styled a caption already knows where everything is.
struct TextLayerInspectorView: View {
    @ObservedObject var session: EditorSession
    let layer: ProjectTextLayer

    private var editor: TextStyleEditor {
        TextStyleEditor(
            style: TextStyle(
                x: layer.x,
                y: layer.y,
                width: layer.width,
                appearance: layer.appearance
            ),
            defaults: .textLayerDefault,
            fontScaleRange: TextAppearance.layerFontScaleRange,
            apply: { patch, live in session.applyTextLayerStyle(patch, to: layer.id, live: live) }
        )
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            essentials
            Divider().opacity(0.45)
            AppearancePositionSection(editor: editor)
            Divider().opacity(0.45)
            AppearanceStrokeSection(editor: editor)
            Divider().opacity(0.45)
            AppearanceBackgroundSection(editor: editor)
            Divider().opacity(0.45)
            AppearanceShadowSection(editor: editor)
            Divider().opacity(0.45)
            footer
        }
    }

    private var essentials: some View {
        VStack(alignment: .leading, spacing: 9) {
            TextEditor(
                text: Binding(
                    get: { layer.text },
                    set: { session.setTextLayerText($0, for: layer.id) }
                )
            )
            .font(.system(size: 14, weight: .semibold))
            .scrollContentBackground(.hidden)
            .padding(7)
            .frame(minHeight: 60, maxHeight: 100)
            .background(Color.studioInputBackground)
            .overlay {
                RoundedRectangle(cornerRadius: 7, style: .continuous)
                    .strokeBorder(Color.studioLine, lineWidth: 1)
            }
            .clipShape(RoundedRectangle(cornerRadius: 7, style: .continuous))

            InspectorRow("Look") {
                InspectorSelect(
                    options: TextTemplate.all.map { .init(value: $0.id, label: $0.name) },
                    selection: TextTemplate.all.first { $0.matches(layer.appearance) }?.id ?? "",
                    onSelect: { id in
                        guard let template = TextTemplate.all.first(where: { $0.id == id })
                        else { return }
                        session.applyTextLayerTemplate(template, to: layer.id)
                    }
                )
            }

            InspectorRow("Font") {
                InspectorSegmentedControl(
                    options: TextLayerFont.allCases.map {
                        .init(value: $0, label: $0.title, font: $0.previewFont())
                    },
                    selection: editor.appearance.font,
                    onSelect: { editor.set(TextStylePatch(font: $0)) }
                )
            }

            InspectorRow("Size") {
                InspectorSlider(
                    value: editor.displaySize,
                    range: editor.displaySizeRange,
                    onChange: { editor.set(TextStylePatch(fontScale: $0 / 1000), live: true) }
                )
            }

            InspectorRow("Case") {
                InspectorSegmentedControl(
                    options: TextCasing.inspectorOptions,
                    selection: editor.appearance.textCase,
                    onSelect: { editor.set(TextStylePatch(textCase: $0)) }
                )
                .help("As typed, lowercase, or UPPERCASE")
            }

            InspectorRow("Fill") {
                InspectorColorWell(color: editor.appearance.color) { color, live in
                    editor.set(TextStylePatch(color: color), live: live)
                }
            }
        }
        .padding(.vertical, 10)
    }

    private var footer: some View {
        HStack {
            Label(
                "\(formatTimePrecise(layer.timelineStart)) – \(formatTimePrecise(layer.timelineStart + layer.duration)) · trim on the timeline",
                systemImage: "arrow.left.and.right"
            )
            .font(.studioCaption)
            .foregroundStyle(.secondary)

            Spacer(minLength: 8)

            Button(role: .destructive) {
                session.deleteSelectedTextLayer()
            } label: {
                Label("Delete", systemImage: "trash")
            }
            .buttonStyle(EditorSecondaryButtonStyle(size: .mini))
        }
        .padding(.vertical, 10)
    }
}
