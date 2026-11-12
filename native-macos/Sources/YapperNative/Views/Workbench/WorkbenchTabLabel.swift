import SwiftUI

/// One tab in the workbench strip: its glyph over its name. The pane on
/// screen is ink on a stone tile, the way the navigation rail marks the
/// current page; the rest are muted.
struct WorkbenchTabLabel: View {
    let tab: WorkbenchTab
    let isActive: Bool

    @State private var isHovering = false

    static let height: CGFloat = 48

    var body: some View {
        VStack(spacing: 4) {
            StudioGlyph(tab.glyph, size: 18)
            Text(tab.rawValue)
                .font(.studioCaptionStrong)
                .lineLimit(1)
                .fixedSize()
        }
        .foregroundStyle(isActive || isHovering ? Color.primary : Color.studioTextMuted)
        .frame(width: tab.stripWidth, height: Self.height)
        .background(
            isActive ? Color.studioSelectedFill : Color.clear,
            in: RoundedRectangle(cornerRadius: StudioRadius.field, style: .continuous)
        )
        .contentShape(Rectangle())
        .onHover { isHovering = $0 }
        .accessibilityAddTraits(isActive ? .isSelected : [])
    }
}
