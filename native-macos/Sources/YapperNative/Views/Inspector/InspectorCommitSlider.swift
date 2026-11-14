import SwiftUI

/// A slider that saves through the same action Chirpy uses for that property:
/// once when the handle is let go, once a keyboard or VoiceOver change pauses,
/// or at once when a number is typed. See `SliderCommitDraft`.
///
/// While it moves the handle follows a local draft, and `onPreview` can show
/// the value somewhere cheap (the canvas) without touching the project.
struct InspectorCommitSlider: View {
    @Environment(\.inspectorControlLabel) private var controlLabel
    let value: Double
    let range: ClosedRange<Double>
    var decimals: Int = 0
    var onPreview: (Double) -> Void = { _ in }
    let onCommit: (Double) async -> Void

    @StateObject private var draft = SliderCommitDraft()

    var body: some View {
        HStack(spacing: 9) {
            Slider(
                value: Binding(get: { draft.value ?? value }, set: { newValue in
                    draft.change(to: newValue, commit: onCommit)
                    onPreview(newValue)
                }),
                in: range,
                onEditingChanged: { editing in
                    if editing { draft.beginDrag() } else { draft.endDrag(commit: onCommit) }
                }
            )
            .accessibilityLabel(controlLabel)
            .controlSize(.small)
            .tint(Color.studioAccent)
            .frame(minWidth: 90, maxWidth: 260)

            InspectorNumberField(
                value: draft.value ?? value,
                range: range,
                decimals: decimals,
                onCommit: { typed in draft.type(typed, commit: onCommit) }
            )
            .fixedSize()
        }
        .onDisappear { draft.flush(commit: onCommit) }
    }
}
