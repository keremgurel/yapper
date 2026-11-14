import SwiftUI

/// A drawn glyph beside its name: the label of a button that has both.
struct StudioGlyphLabel: View {
    let title: String
    let glyph: StudioGlyphKind
    var size: CGFloat = 15

    init(_ title: String, glyph: StudioGlyphKind, size: CGFloat = 15) {
        self.title = title
        self.glyph = glyph
        self.size = size
    }

    var body: some View {
        HStack(spacing: 6) {
            StudioGlyph(glyph, size: size)
            Text(title)
        }
    }
}
