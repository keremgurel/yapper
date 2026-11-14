import SwiftUI

/// The two editor layouts, as a stone tray with the current one raised: the
/// same segmented control the rest of the product uses, drawn with pictures of
/// the layouts themselves.
struct EditorLayoutPicker: View {
    let mode: EditorLayoutMode
    let onSelect: (EditorLayoutMode) -> Void

    var body: some View {
        HStack(spacing: 2) {
            ForEach(EditorLayoutMode.allCases) { option in
                let isSelected = option == mode
                Button {
                    onSelect(option)
                } label: {
                    StudioGlyph(option.glyph, size: 15)
                        .foregroundStyle(isSelected ? Color.primary : Color.studioTextMuted)
                        .frame(width: 30, height: 24)
                        .background {
                            if isSelected {
                                Capsule(style: .continuous)
                                    .fill(Color.studioRaisedChip)
                                    .shadow(color: .black.opacity(0.14), radius: 1.5, y: 0.5)
                            }
                        }
                        .contentShape(Rectangle())
                }
                .buttonStyle(.studioPlain)
                .help(option.purpose)
                .accessibilityLabel(option.title)
                .accessibilityAddTraits(isSelected ? .isSelected : [])
            }
        }
        .padding(2)
        .background(Color.studioTray, in: Capsule(style: .continuous))
    }
}
