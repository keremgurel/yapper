import SwiftUI

/// The well a sheet's text and number fields sit in, so they match the
/// inspector's fields rather than the system's bezel.
private struct StudioSheetFieldWell: ViewModifier {
    @FocusState private var isFocused: Bool

    func body(content: Content) -> some View {
        content
            .textFieldStyle(.plain)
            .font(.studioLabelStrong)
            .focused($isFocused)
            .padding(.horizontal, 8)
            .frame(height: InspectorMetrics.controlHeight)
            .background(
                Color.studioInputBackground,
                in: RoundedRectangle(cornerRadius: StudioRadius.control, style: .continuous)
            )
            .overlay {
                RoundedRectangle(cornerRadius: StudioRadius.control, style: .continuous)
                    .strokeBorder(isFocused ? Color.studioAccent.opacity(0.55) : Color.clear, lineWidth: 1)
            }
    }
}

/// A number with its name above it and its unit after it.
struct StudioSheetNumberField: View {
    let label: String
    @Binding var value: Double
    var decimals = 2
    var unit: String?
    var width: CGFloat = 64
    /// False for every row after the first in a list of like rows, where the
    /// first row's names already head the columns.
    var showsLabel = true

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            if showsLabel {
                Text(label)
                    .font(.studioCaption)
                    .foregroundStyle(Color.studioTextMuted)
                    .lineLimit(1)
                    .fixedSize()
            }
            HStack(spacing: 4) {
                TextField(label, value: $value, format: .number.precision(.fractionLength(decimals)))
                    .accessibilityLabel(label)
                    .monospacedDigit()
                    .multilineTextAlignment(.trailing)
                    .modifier(StudioSheetFieldWell())
                    .frame(width: width)
                if let unit {
                    Text(unit).font(.studioCaption).foregroundStyle(Color.studioTextMuted)
                }
            }
        }
    }
}

/// A line of text in a sheet.
struct StudioSheetTextField: View {
    let placeholder: String
    @Binding var text: String

    var body: some View {
        TextField(placeholder, text: $text)
            .modifier(StudioSheetFieldWell())
    }
}

/// A switch with its name beside it.
struct StudioSheetSwitchRow: View {
    let title: String
    @Binding var isOn: Bool

    var body: some View {
        HStack(spacing: 8) {
            StudioSwitch(isOn: $isOn).accessibilityLabel(title)
            Text(title).font(.studioLabel)
        }
    }
}

/// How a keyframe eases into the next one.
struct StudioSheetEasingControl: View {
    @Binding var easing: AnimationEase

    var body: some View {
        InspectorSegmentedControl(
            options: [
                .init(value: AnimationEase.linear, label: "Linear"),
                .init(value: AnimationEase.smooth, label: "Smooth"),
            ],
            selection: easing
        ) { easing = $0 }
    }
}

/// Takes a keyframe out of a sheet's list.
struct StudioSheetRemoveButton: View {
    let help: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            StudioGlyph(.delete, size: 14).frame(width: 26, height: 26)
        }
        .buttonStyle(EditorGhostButtonStyle(size: .mini))
        .help(help)
        .accessibilityLabel(help)
    }
}
