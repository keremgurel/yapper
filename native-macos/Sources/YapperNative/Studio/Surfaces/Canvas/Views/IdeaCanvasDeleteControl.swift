import SwiftUI

/// Delete, confirmed in place: the trash button turns into "Delete this
/// idea?" with the real delete and a way back, instead of a dialog.
struct IdeaCanvasDeleteControl: View {
    let disabled: Bool
    let onConfirm: () -> Void
    @State private var confirming = false

    var body: some View {
        HStack(spacing: 6) {
            if confirming {
                Text("Delete this idea?").font(.system(size: 12, weight: .medium)).foregroundStyle(.secondary)
                Button("Delete") {
                    confirming = false
                    onConfirm()
                }
                .buttonStyle(EditorDestructiveButtonStyle(size: .small))
                Button("Keep") { confirming = false }
                    .buttonStyle(EditorGhostButtonStyle(size: .small))
            } else {
                Button { withAnimation(.snappy(duration: 0.18)) { confirming = true } } label: {
                    Image(systemName: "trash").font(.system(size: 13))
                }
                .buttonStyle(EditorSecondaryButtonStyle(size: .small))
                .help("Delete this idea")
            }
        }
        .disabled(disabled)
    }
}
