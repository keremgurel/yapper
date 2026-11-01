import SwiftUI

/// A slider that saves once, when the handle is let go or a number is typed,
/// through the same action Chirpy uses for that property.
///
/// While it is dragged the handle follows a local draft, and `onPreview` can
/// show the value somewhere cheap (the canvas) without touching the project.
/// The draft stays until the commit has landed, so the handle does not jump
/// back to the old value for the moment the save takes.
struct InspectorCommitSlider: View {
    @Environment(\.inspectorControlLabel) private var controlLabel
    let value: Double
    let range: ClosedRange<Double>
    var decimals: Int = 0
    var onPreview: (Double) -> Void = { _ in }
    let onCommit: (Double) async -> Void

    @State private var draft: Double?

    var body: some View {
        HStack(spacing: 9) {
            Slider(
                value: Binding(get: { draft ?? value }, set: { newValue in
                    draft = newValue
                    onPreview(newValue)
                }),
                in: range,
                onEditingChanged: { editing in
                    guard !editing, let released = draft else { return }
                    commit(released)
                }
            )
            .accessibilityLabel(controlLabel)
            .controlSize(.small)
            .tint(Color.yapperOrange)

            InspectorNumberField(
                value: draft ?? value,
                range: range,
                decimals: decimals,
                onCommit: { typed in
                    draft = typed
                    commit(typed)
                }
            )
        }
    }

    private func commit(_ released: Double) {
        Task {
            await onCommit(released)
            if draft == released { draft = nil }
        }
    }
}
