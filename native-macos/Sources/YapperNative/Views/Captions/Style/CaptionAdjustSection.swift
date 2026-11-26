import SwiftUI

/// The five things people change on captions after picking a look, each on
/// one row, every control ending at the same right edge.
struct CaptionAdjustSection: View {
    @ObservedObject var session: EditorSession
    let editor: TextStyleEditor

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            InspectorRow("Words") {
                InspectorSegmentedControl(
                    options: [1, 2, 3, 4, 5, CaptionWordsPerCard.auto].map { .init(value: $0, label: CaptionWordsPerCard.label($0)) },
                    selection: session.captionWordsPerCard,
                    onSelect: session.setCaptionWordsPerCard
                )
            }
            .help("How many spoken words each caption shows. Changing it rebuilds every caption.")

            InspectorRow("Size") {
                InspectorSlider(
                    value: editor.displaySize,
                    range: editor.displaySizeRange,
                    onChange: { editor.set(TextStylePatch(fontScale: $0 / 1000), live: true) }
                )
            }

            InspectorRow("Position", detail: "Or drag a caption on the video.") {
                InspectorSegmentedControl(
                    options: CaptionPlacement.allCases.map { .init(value: $0, label: $0.title) },
                    selection: CaptionPlacement(y: editor.y),
                    onSelect: { editor.set(TextStylePatch(y: $0.y)) }
                )
            }

            InspectorRow("Case") {
                InspectorSegmentedControl(
                    options: TextCasing.inspectorOptions,
                    selection: editor.appearance.textCase,
                    onSelect: { editor.set(TextStylePatch(textCase: $0)) }
                )
            }

            InspectorRow("Colour") {
                CaptionColorRow(color: editor.appearance.color) { color, live in
                    editor.set(TextStylePatch(color: color), live: live)
                }
            }
        }
        .environment(\.inspectorFillsWidth, true)
    }
}

/// Where captions sit, in the three places people actually put them.
enum CaptionPlacement: CaseIterable, Hashable {
    case top
    case middle
    case bottom
    case custom

    static var allCases: [CaptionPlacement] { [.top, .middle, .bottom] }

    var title: String {
        switch self {
        case .top: "Top"
        case .middle: "Middle"
        case .bottom: "Bottom"
        case .custom: "Custom"
        }
    }

    var y: Double {
        switch self {
        case .top: 0.22
        case .middle: 0.5
        case .bottom, .custom: 0.75
        }
    }

    init(y: Double) {
        self = CaptionPlacement.allCases.first { abs($0.y - y) < 0.04 } ?? .custom
    }
}

/// A few colours captions are actually set in, and the full picker after them.
private struct CaptionColorRow: View {
    let color: StudioColor
    let onChange: (StudioColor, Bool) -> Void

    private static let swatches = ["#FFFFFF", "#FFD93D", "#B8F34A", "#FF7A21", "#FF5A5F", "#000000"]

    var body: some View {
        HStack(spacing: 8) {
            ForEach(Self.swatches, id: \.self) { hex in
                let swatch = StudioColor(hex: hex) ?? .white
                let isOn = swatch.hex.uppercased() == color.withOpacity(1).hex.uppercased()
                Button { onChange(swatch, false) } label: {
                    Circle()
                        .fill(swatch.swiftUIColor)
                        .frame(width: 20, height: 20)
                        .overlay { Circle().strokeBorder(Color.studioLineStrong, lineWidth: 0.7) }
                        .overlay {
                            if isOn { Circle().inset(by: -3).strokeBorder(Color.studioAccent, lineWidth: 1.5) }
                        }
                        .padding(3)
                        .contentShape(Circle())
                }
                .buttonStyle(.studioPlain)
                .help(hex)
                .accessibilityLabel("Colour \(hex)")
                .accessibilityAddTraits(isOn ? .isSelected : [])
            }
            Spacer(minLength: 4)
            InspectorColorWell(color: color, onChange: onChange)
        }
    }
}
