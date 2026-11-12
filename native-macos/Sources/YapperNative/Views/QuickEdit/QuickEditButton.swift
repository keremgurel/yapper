import SwiftUI

/// One of the smaller edits, as a button that says what it does. The longer
/// explanation is in its tooltip.
struct QuickEditButton: View {
    let glyph: StudioGlyphKind
    let title: String
    let help: String
    var disabled = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            StudioGlyphLabel(title, glyph: glyph, size: 13)
        }
        .buttonStyle(EditorSecondaryButtonStyle(size: .small))
        .fixedSize()
        .disabled(disabled)
        .help(help)
    }
}
