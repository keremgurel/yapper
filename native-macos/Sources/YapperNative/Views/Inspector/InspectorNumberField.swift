import SwiftUI

/// A compact numeric field: reads the current value, takes a typed one, and
/// stays out of the way otherwise. Pairs with `InspectorSlider`, and stands
/// alone for properties that are a coordinate rather than an amount.
struct InspectorNumberField: View {
    @Environment(\.inspectorControlLabel) private var controlLabel
    let value: Double
    let range: ClosedRange<Double>
    var decimals: Int = 0
    var width: CGFloat = 48
    /// Called once the creator commits: Return, or leaving the field.
    let onCommit: (Double) -> Void

    @State private var text = ""
    @FocusState private var isFocused: Bool

    var body: some View {
        TextField(controlLabel, text: $text)
            .accessibilityLabel(controlLabel)
            .textFieldStyle(.plain)
            .font(.studioLabelStrong)
            .monospacedDigit()
            .multilineTextAlignment(.center)
            .focused($isFocused)
            .frame(width: width, height: InspectorMetrics.controlHeight)
            .background(Color.studioInputBackground)
            .clipShape(RoundedRectangle(cornerRadius: StudioRadius.control, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: StudioRadius.control, style: .continuous)
                    .strokeBorder(
                        isFocused ? Color.studioAccent.opacity(0.55) : Color.clear,
                        lineWidth: 1
                    )
            }
            .onSubmit(commit)
            .onAppear { text = formatted(value) }
            .onChange(of: value) { _, updated in
                guard !isFocused else { return }
                text = formatted(updated)
            }
            .onChange(of: isFocused) { _, focused in
                if !focused { commit() }
            }
    }

    private func commit() {
        guard let typed = Double(text.replacingOccurrences(of: ",", with: ".")) else {
            text = formatted(value)
            return
        }
        let clamped = min(range.upperBound, max(range.lowerBound, typed))
        text = formatted(clamped)
        guard clamped != value else { return }
        onCommit(clamped)
    }

    private func formatted(_ value: Double) -> String {
        String(format: "%.\(decimals)f", value)
    }
}

/// A slider with its value spelled out beside it. The slider streams while it is
/// dragged, so a whole gesture lands as one undo step rather than one per pixel.
struct InspectorSlider: View {
    @Environment(\.inspectorControlLabel) private var controlLabel
    let value: Double
    let range: ClosedRange<Double>
    var decimals: Int = 0
    /// Fires continuously during a drag.
    let onChange: (Double) -> Void

    var body: some View {
        HStack(spacing: 9) {
            Slider(
                value: Binding(get: { value }, set: onChange),
                in: range
            )
            .accessibilityLabel(controlLabel)
            .controlSize(.small)
            .tint(Color.studioAccent)
            .frame(minWidth: 90, maxWidth: 260)

            InspectorNumberField(
                value: value,
                range: range,
                decimals: decimals,
                onCommit: onChange
            )
            .fixedSize()
        }
    }
}
