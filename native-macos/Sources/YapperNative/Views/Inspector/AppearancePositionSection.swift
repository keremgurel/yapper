import SwiftUI

/// Where the text sits on the stage and how wide it is allowed to run. Shared by
/// captions and text layers; anything that is only true of one of them (how many
/// words a caption card holds, say) belongs in that inspector, not here.
///
/// Called Position, like the section that moves a cutaway and the one that moves
/// the speaker's own picture. It was Layout here and Position there, which meant
/// learning the same idea twice under two names.
struct AppearancePositionSection: View {
    let editor: TextStyleEditor

    var body: some View {
        InspectorSection(
            "Position",
            id: "position",
            expandedByDefault: false,
            isModified: editor.x != editor.defaults.x
                || editor.y != editor.defaults.y
                || editor.width != editor.defaults.width,
            onReset: {
                editor.set(
                    TextStylePatch(
                        x: editor.defaults.x,
                        y: editor.defaults.y,
                        width: editor.defaults.width
                    )
                )
            }
        ) {
            InspectorRow("Position") {
                HStack(spacing: 6) {
                    coordinate("X", value: editor.x) { editor.set(TextStylePatch(x: $0 / 100)) }
                    coordinate("Y", value: editor.y) { editor.set(TextStylePatch(y: $0 / 100)) }
                }
            }

            InspectorRow("Anchor") {
                InspectorSegmentedControl(
                    options: AppearancePositionSection.anchors.map {
                        .init(value: $0.y, label: "", systemImage: $0.icon)
                    },
                    selection: nearestAnchor,
                    onSelect: { editor.set(TextStylePatch(x: 0.5, y: $0)) }
                )
                .frame(width: 108)
                .help("Drop the text at the top, the middle or the bottom of the frame")
            }

            InspectorRow("Width") {
                InspectorSlider(
                    value: editor.width * 100,
                    range: (TextStyle.minimumWidth * 100) ... (TextStyle.maximumWidth * 100),
                    onChange: { editor.set(TextStylePatch(width: $0 / 100), live: true) }
                )
            }
        }
    }

    private func coordinate(
        _ label: String,
        value: Double,
        onCommit: @escaping (Double) -> Void
    ) -> some View {
        HStack(spacing: 4) {
            Text(label)
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(.tertiary)
            InspectorNumberField(
                value: (value * 100).rounded(),
                range: 5 ... 95,
                width: 40,
                onCommit: onCommit
            )
        }
    }

    private static let anchors: [(y: Double, icon: String)] = [
        (0.16, "arrow.up.to.line"),
        (0.5, "arrow.up.and.down"),
        (0.82, "arrow.down.to.line"),
    ]

    /// The preset the text is sitting on, if it is sitting on one. A card
    /// dragged somewhere of its own leaves all three unlit rather than claiming
    /// the nearest, which would be a lie about where it is.
    private var nearestAnchor: Double {
        AppearancePositionSection.anchors
            .first { abs($0.y - editor.y) < 0.02 }?
            .y ?? -1
    }
}
