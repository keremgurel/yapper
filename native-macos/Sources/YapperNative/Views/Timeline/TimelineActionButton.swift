import SwiftUI

/// A labelled timeline action with its keyboard shortcut shown when space
/// allows. Narrow toolbars fall back to the label and then its unambiguous icon.
struct TimelineActionButton: View {
    let title: String
    let systemImage: String
    let shortcut: String
    let help: String
    let action: () -> Void

    @State private var isHovering = false

    var body: some View {
        Button(action: action) {
            ViewThatFits(in: .horizontal) {
                HStack(spacing: 5) {
                    actionLabel
                    shortcutLabel
                }
                .fixedSize(horizontal: true, vertical: false)

                actionLabel
                    .fixedSize(horizontal: true, vertical: false)

                Image(systemName: systemImage)
                    .font(.system(size: 11, weight: .semibold))
                    .accessibilityHidden(true)
                    .frame(minWidth: 14)
            }
            .padding(.horizontal, 8)
            .frame(height: 26)
            .background(isHovering ? Color.studioFaintFill : Color.clear)
            .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 6, style: .continuous)
                    .stroke(Color.studioLine, lineWidth: 1)
            }
            .contentShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
        }
        .buttonStyle(.studioPlain)
        .clickableCursor()
        .onHover { isHovering = $0 }
        .help("\(help) · \(shortcut)")
        .accessibilityLabel(title)
        .accessibilityHint("\(help). Keyboard shortcut: \(shortcut)")
    }

    private var actionLabel: some View {
        Label(title, systemImage: systemImage)
            .font(.studioCaptionStrong)
    }

    private var shortcutLabel: some View {
        Text(shortcut)
            .font(.system(size: 9.5, weight: .semibold, design: .monospaced))
            .foregroundStyle(.secondary)
            .padding(.horizontal, 3.5)
            .padding(.vertical, 1)
            .background(Color.studioFaintFill)
            .clipShape(RoundedRectangle(cornerRadius: 3, style: .continuous))
    }
}
