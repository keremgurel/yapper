import SwiftUI

/// A trash button that opens into Delete and Cancel in place, so a row never
/// needs an alert to ask whether the creator meant it.
struct BrainConfirmDeleteButton: View {
    let label: String
    var busy = false
    let onConfirm: () -> Void

    @State private var confirming = false

    var body: some View {
        HStack(spacing: 4) {
            if confirming {
                Button("Delete") {
                    confirming = false
                    onConfirm()
                }
                .buttonStyle(EditorDestructiveButtonStyle(size: .mini))
                Button("Cancel") { confirming = false }
                    .buttonStyle(EditorGhostButtonStyle(size: .mini))
            } else if busy {
                ProgressView().controlSize(.small).frame(width: 24, height: 24)
            } else {
                Button { confirming = true } label: {
                    Image(systemName: "trash")
                        .font(.system(size: 12))
                        .foregroundStyle(.secondary)
                        .frame(width: 24, height: 24)
                }
                .buttonStyle(.studioPlain)
                .help(label)
                .accessibilityLabel(label)
            }
        }
        .onExitCommand { confirming = false }
    }
}
