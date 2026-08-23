import SwiftUI

/// The caption styling panel.
///
/// The shape every properties panel in the editor now follows: the handful of
/// things you reach for constantly are on screen the moment the panel opens,
/// and everything else is folded into sections that are named the same as their
/// counterparts elsewhere. Position is Position whether you are moving a
/// caption, a text layer or a cutaway, and it is in the same place each time,
/// which is what lets somebody learn the panel once instead of per tab.
struct CaptionInspectorView: View {
    @ObservedObject var session: EditorSession
    @ObservedObject private var captionSelection: CaptionSelectionState

    init(session: EditorSession) {
        self.session = session
        _captionSelection = ObservedObject(wrappedValue: session.captionSelection)
    }

    private var style: TextStyle { session.editingCaptionStyle }
    private var noTarget: Bool { session.captionStylingHasNoTarget }

    private var editor: TextStyleEditor {
        TextStyleEditor(
            style: style,
            defaults: .default,
            fontScaleRange: TextAppearance.fontScaleRange,
            apply: { patch, live in session.setCaptionStyle(patch, live: live) }
        )
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            essentials

            Group {
                sectionDivider
                AppearancePositionSection(editor: editor)
                sectionDivider
                AppearanceStrokeSection(editor: editor)
                sectionDivider
                AppearanceBackgroundSection(editor: editor)
                sectionDivider
                AppearanceShadowSection(editor: editor)
            }
            .disabled(noTarget)
            .opacity(noTarget ? 0.45 : 1)
        }
    }

    private var sectionDivider: some View {
        Divider().opacity(0.45)
    }

    /// What gets touched on nearly every caption pass: what the cards say, what
    /// they are set in, and who the change lands on. None of it is folded away,
    /// because folding the things people came here for is how a panel ends up
    /// feeling like a filing cabinet.
    private var essentials: some View {
        VStack(alignment: .leading, spacing: 9) {
            InspectorCheckbox(
                title: "Apply to all captions",
                isOn: Binding(
                    get: { session.captionApplyToAll },
                    set: { session.captionApplyToAll = $0 }
                ),
                detail: scopeDetail
            )

            InspectorRow("Words") {
                InspectorSegmentedControl(
                    options: CaptionWordsPerCard.options.map {
                        .init(value: $0, label: CaptionWordsPerCard.label($0))
                    },
                    selection: session.captionWordsPerCard,
                    onSelect: session.setCaptionWordsPerCard
                )
            }
            .help(
                "Full cards hold exactly this many spoken words. Only the final card at the end of the video, a source change, or an edit cut can be shorter. Changing it rebuilds every card."
            )

            Group {
                InspectorRow("Look") {
                    InspectorSelect(
                        options: TextTemplate.all.map { .init(value: $0.id, label: $0.name) },
                        selection: TextTemplate.all.first { $0.matches(style.appearance) }?.id ?? "",
                        onSelect: { id in
                            guard let template = TextTemplate.all.first(where: { $0.id == id })
                            else { return }
                            session.applyCaptionTemplate(template)
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
            .disabled(noTarget)
            .opacity(noTarget ? 0.45 : 1)
        }
        .padding(.vertical, 10)
    }

    private var scopeDetail: String? {
        guard !session.captionApplyToAll else { return nil }
        let count = session.selectedCaptionIDs.count
        return count == 0
            ? "Pick captions in the list or on the video to restyle just those."
            : "Changes land on \(count) caption\(count == 1 ? "" : "s")."
    }
}
