import SwiftUI

/// One step of a Simple edit, as a pill. The step to do next is the filled
/// one; a finished step carries a tick and opens where it can be changed.
struct EditStepChip: View {
    enum Status { case todo, next, done }

    let title: String
    let status: Status
    let help: String
    var disabled = false
    let action: () -> Void

    var body: some View {
        if status == .next {
            button.buttonStyle(EditorPrimaryButtonStyle(size: .small))
        } else {
            button.buttonStyle(EditorSecondaryButtonStyle(size: .small))
        }
    }

    private var button: some View {
        Button(action: action) {
            HStack(spacing: 5) {
                if status == .done {
                    StudioGlyph(.check, size: 11).foregroundStyle(Color.studioSuccess)
                }
                Text(title).monospacedDigit()
            }
        }
        .disabled(disabled)
        .help(help)
    }
}
