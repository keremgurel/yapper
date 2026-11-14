import SwiftUI

/// One of the smaller edits, as a tile the same shape as the 1-Click Edit
/// band above it: the action it takes, and one line on where things stand.
///
/// Tiles share a grid, so every one is the same size whatever its words are,
/// and a new action takes its place without the row being rearranged.
struct QuickEditTile: View {
    let glyph: StudioGlyphKind
    let title: String
    let state: String
    let help: String
    var disabled = false
    let action: () -> Void

    @State private var isHovering = false

    var body: some View {
        Button(action: action) {
            HStack(spacing: 10) {
                StudioGlyph(glyph, size: 16)
                    .frame(width: 30, height: 30)
                    .background(
                        Color.studioTray,
                        in: RoundedRectangle(cornerRadius: StudioRadius.field, style: .continuous)
                    )
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.studioBodyStrong)
                        .lineLimit(1)
                    Text(state)
                        .font(.studioCaption)
                        .monospacedDigit()
                        .foregroundStyle(Color.studioTextMuted)
                        .lineLimit(1)
                }
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 12)
            .frame(maxWidth: .infinity, minHeight: 54, alignment: .leading)
            .background(
                isHovering && !disabled ? Color.studioSelectedFill : Color.raisedBackground,
                in: RoundedRectangle(cornerRadius: StudioRadius.panel, style: .continuous)
            )
            .overlay {
                RoundedRectangle(cornerRadius: StudioRadius.panel, style: .continuous)
                    .strokeBorder(Color.studioLine, lineWidth: 1)
            }
            .contentShape(RoundedRectangle(cornerRadius: StudioRadius.panel, style: .continuous))
        }
        .buttonStyle(.studioPlain)
        .disabled(disabled)
        .opacity(disabled ? 0.5 : 1)
        .onHover { isHovering = $0 }
        .clickableCursor(enabled: !disabled)
        .help(help)
    }
}
