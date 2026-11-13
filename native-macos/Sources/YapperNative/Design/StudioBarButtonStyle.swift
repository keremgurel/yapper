import SwiftUI

/// A quiet control in one of the editor's bars: no chrome until the pointer
/// is over it, then a faint tile. One style for the transport, the zoom
/// steppers and anything else that sits in a 40-point bar, so the bars do not
/// each grow their own bordered boxes.
struct StudioBarButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled
    @State private var isHovering = false
    /// Drawn on a tile all the time rather than only under the pointer. For
    /// the one control in a bar that should read as a button at rest.
    var isProminent = false

    static let height: CGFloat = 28

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.studioLabelStrong)
            .lineLimit(1)
            .fixedSize()
            .foregroundStyle(Color.primary)
            .frame(minWidth: Self.height, minHeight: Self.height)
            .background(fill(pressed: configuration.isPressed), in: shape)
            .contentShape(shape)
            .opacity(isEnabled ? 1 : 0.38)
            .onHover { isHovering = $0 }
            .clickableCursor(enabled: isEnabled)
    }

    private var shape: RoundedRectangle {
        RoundedRectangle(cornerRadius: StudioRadius.control, style: .continuous)
    }

    private func fill(pressed: Bool) -> Color {
        if pressed, isEnabled { return .studioSelectedFill }
        if isProminent || (isHovering && isEnabled) { return .studioFaintFill }
        return .clear
    }
}
