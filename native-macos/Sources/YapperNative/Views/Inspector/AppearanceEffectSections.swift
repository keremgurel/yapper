import SwiftUI

/// The outline around the glyphs. Off by default, and the fastest way to make
/// text hold up over busy footage.
struct AppearanceStrokeSection: View {
    let editor: TextStyleEditor

    private var isModified: Bool {
        editor.appearance.strokeEnabled != editor.defaultAppearance.strokeEnabled
            || editor.appearance.strokeColor != editor.defaultAppearance.strokeColor
            || editor.appearance.strokeWidth != editor.defaultAppearance.strokeWidth
    }

    var body: some View {
        InspectorSection(
            "Stroke",
            id: "stroke",
            expandedByDefault: false,
            isEnabled: editor.flag(editor.appearance.strokeEnabled, \.strokeEnabled),
            isModified: isModified,
            onReset: {
                editor.set(
                    TextStylePatch(
                        strokeEnabled: editor.defaultAppearance.strokeEnabled,
                        strokeColor: editor.defaultAppearance.strokeColor,
                        strokeWidth: editor.defaultAppearance.strokeWidth
                    )
                )
            }
        ) {
            InspectorRow("Color") {
                InspectorColorWell(color: editor.appearance.strokeColor) { color, live in
                    editor.set(TextStylePatch(strokeColor: color), live: live)
                }
            }
            InspectorRow("Weight") {
                InspectorSlider(
                    value: editor.appearance.strokeWidth * 100,
                    range: percentRange(TextAppearance.strokeWidthRange),
                    onChange: { editor.set(TextStylePatch(strokeWidth: $0 / 100), live: true) }
                )
            }
        }
    }
}

/// The card the words sit on.
struct AppearanceBackgroundSection: View {
    let editor: TextStyleEditor

    private var isModified: Bool {
        editor.appearance.backgroundEnabled != editor.defaultAppearance.backgroundEnabled
            || editor.appearance.backgroundColor != editor.defaultAppearance.backgroundColor
            || editor.appearance.cornerRadius != editor.defaultAppearance.cornerRadius
    }

    var body: some View {
        InspectorSection(
            "Background",
            id: "background",
            expandedByDefault: false,
            isEnabled: editor.flag(editor.appearance.backgroundEnabled, \.backgroundEnabled),
            isModified: isModified,
            onReset: {
                editor.set(
                    TextStylePatch(
                        backgroundEnabled: editor.defaultAppearance.backgroundEnabled,
                        backgroundColor: editor.defaultAppearance.backgroundColor,
                        cornerRadius: editor.defaultAppearance.cornerRadius
                    )
                )
            }
        ) {
            InspectorRow("Color") {
                InspectorColorWell(color: editor.appearance.backgroundColor) { color, live in
                    editor.set(TextStylePatch(backgroundColor: color), live: live)
                }
            }
            InspectorRow("Radius") {
                InspectorSlider(
                    value: editor.appearance.cornerRadius * 100,
                    range: percentRange(TextAppearance.cornerRadiusRange),
                    onChange: { editor.set(TextStylePatch(cornerRadius: $0 / 100), live: true) }
                )
            }
        }
    }
}

/// The drop shadow. On a card it falls from the card; on bare text it falls from
/// the words themselves, which is what makes plain captions readable.
struct AppearanceShadowSection: View {
    let editor: TextStyleEditor

    private var isModified: Bool {
        editor.appearance.shadowEnabled != editor.defaultAppearance.shadowEnabled
            || editor.appearance.shadowColor != editor.defaultAppearance.shadowColor
            || editor.appearance.shadowRadius != editor.defaultAppearance.shadowRadius
    }

    var body: some View {
        InspectorSection(
            "Shadow",
            id: "shadow",
            expandedByDefault: false,
            isEnabled: editor.flag(editor.appearance.shadowEnabled, \.shadowEnabled),
            isModified: isModified,
            onReset: {
                editor.set(
                    TextStylePatch(
                        shadowEnabled: editor.defaultAppearance.shadowEnabled,
                        shadowColor: editor.defaultAppearance.shadowColor,
                        shadowRadius: editor.defaultAppearance.shadowRadius
                    )
                )
            }
        ) {
            InspectorRow("Color") {
                InspectorColorWell(color: editor.appearance.shadowColor) { color, live in
                    editor.set(TextStylePatch(shadowColor: color), live: live)
                }
            }
            InspectorRow("Blur") {
                InspectorSlider(
                    value: editor.appearance.shadowRadius * 100,
                    range: percentRange(TextAppearance.shadowRadiusRange),
                    onChange: { editor.set(TextStylePatch(shadowRadius: $0 / 100), live: true) }
                )
            }
        }
    }
}

/// The model stores these as fractions of the font size; the sliders show them
/// as percentages, because "9" beats "0.09" on a panel.
private func percentRange(_ range: ClosedRange<Double>) -> ClosedRange<Double> {
    (range.lowerBound * 100) ... (range.upperBound * 100)
}
