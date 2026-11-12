import SwiftUI

/// One of the smaller edits: what it is, what it will do, and a button named
/// for the action it takes.
struct QuickEditRow: View {
    let glyph: StudioGlyphKind
    let title: String
    let detail: String
    let actionTitle: String
    var disabled = false
    let action: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            StudioGlyph(glyph, size: 17)
                .frame(width: 32, height: 32)
                .background(
                    Color.studioTray,
                    in: RoundedRectangle(cornerRadius: StudioRadius.field, style: .continuous)
                )
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.studioBodyStrong)
                Text(detail)
                    .font(.studioCaption)
                    .foregroundStyle(Color.studioTextMuted)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 8)
            Button(actionTitle, action: action)
                .buttonStyle(EditorSecondaryButtonStyle(size: .small))
                .fixedSize()
                .disabled(disabled)
        }
        .padding(.vertical, 10)
        .opacity(disabled ? 0.55 : 1)
    }
}
