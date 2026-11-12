import SwiftUI

/// One action in the timeline toolbar: an icon, and its name when the toolbar
/// has room for names.
///
/// The toolbar decides whether names are shown, for every button at once. Left
/// to choose for itself, each button dropped its name at a different width and
/// the row read as a mix of words and bare icons. The keyboard shortcut lives
/// in the tooltip rather than on the face.
struct TimelineActionButton: View {
    let title: String
    let systemImage: String
    let shortcut: String
    let help: String
    var showsTitle = true
    /// A switch that is on draws a filled tile; an action leaves this nil.
    var isOn: Bool?
    let action: () -> Void

    @Environment(\.isEnabled) private var isEnabled
    @State private var isHovering = false

    static let height: CGFloat = 28

    var body: some View {
        Button(action: action) {
            HStack(spacing: 5) {
                Image(systemName: systemImage)
                    .font(.system(size: 12, weight: .medium))
                    .frame(width: 16)
                    .accessibilityHidden(true)
                if showsTitle {
                    Text(title)
                        .font(.studioLabelStrong)
                        .lineLimit(1)
                }
            }
            .fixedSize(horizontal: true, vertical: false)
            .foregroundStyle(isOn == false ? Color.studioTextMuted : Color.primary)
            .padding(.horizontal, showsTitle ? 8 : 6)
            .frame(height: Self.height)
            .background(fill, in: shape)
            .contentShape(shape)
        }
        .buttonStyle(.studioPlain)
        .opacity(isEnabled ? 1 : 0.38)
        .onHover { isHovering = $0 }
        .help("\(help) · \(shortcut)")
        .accessibilityLabel(title)
        .accessibilityHint("\(help). Keyboard shortcut: \(shortcut)")
    }

    private var shape: RoundedRectangle {
        RoundedRectangle(cornerRadius: StudioRadius.control, style: .continuous)
    }

    private var fill: Color {
        if isOn == true { return .studioSelectedFill }
        return isHovering && isEnabled ? .studioFaintFill : .clear
    }
}
