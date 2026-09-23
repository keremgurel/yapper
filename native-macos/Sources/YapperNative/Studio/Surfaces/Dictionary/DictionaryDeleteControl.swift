import SwiftUI

/// Delete with an in-place confirm: the trash button turns into Delete and
/// Cancel on the same spot, so nothing is removed on one stray click.
struct DictionaryDeleteControl: View {
    let term: String
    var disabled = false
    let onConfirm: () -> Void
    @State private var confirming = false

    var body: some View {
        if confirming {
            HStack(spacing: 6) {
                Button("Cancel") { confirming = false }
                    .buttonStyle(EditorGhostButtonStyle(size: .small))
                Button {
                    confirming = false
                    onConfirm()
                } label: {
                    Text("Delete").foregroundStyle(Color.studioDanger)
                }
                .buttonStyle(EditorSecondaryButtonStyle(size: .small))
                .disabled(disabled)
            }
        } else {
            Button {
                confirming = true
            } label: {
                Image(systemName: "trash").font(.system(size: 13))
            }
            .buttonStyle(EditorGhostButtonStyle(size: .small))
            .foregroundStyle(.secondary)
            .disabled(disabled)
            .help("Delete \(term)")
            .accessibilityLabel("Delete \(term)")
        }
    }
}
