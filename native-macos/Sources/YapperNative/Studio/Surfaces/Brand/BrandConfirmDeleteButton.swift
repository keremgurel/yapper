import SwiftUI

/// A trash button that asks in place: the first click swaps it for
/// "Delete" and "Keep", so nothing is removed by a single stray click.
struct BrandConfirmDeleteButton: View {
    let label: String
    let onConfirm: () -> Void
    @State private var confirming = false

    var body: some View {
        if confirming {
            HStack(spacing: 4) {
                Button("Keep") { confirming = false }
                    .buttonStyle(EditorGhostButtonStyle(size: .mini))
                Button("Delete") {
                    confirming = false
                    onConfirm()
                }
                .buttonStyle(EditorDestructiveButtonStyle(size: .mini))
            }
            .transition(.opacity)
        } else {
            Button { withAnimation(.easeOut(duration: 0.15)) { confirming = true } } label: {
                Image(systemName: "trash").font(.system(size: 12))
            }
            .buttonStyle(EditorGhostButtonStyle(size: .small))
            .help(label)
            .accessibilityLabel(label)
        }
    }
}
