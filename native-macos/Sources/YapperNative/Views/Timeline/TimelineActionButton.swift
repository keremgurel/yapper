import SwiftUI

/// A labelled timeline action with its keyboard shortcut shown inline.
///
/// The toolbar used to be bare icons leaning on tooltips, which meant the
/// actions and their shortcuts were effectively undiscoverable.
struct TimelineActionButton: View {
    let title: String
    let systemImage: String
    let shortcut: String
    let help: String
    let action: () -> Void

    @State private var isHovering = false

    var body: some View {
        Button(action: action) {
            HStack(spacing: 5) {
                Image(systemName: systemImage)
                    .font(.system(size: 11, weight: .semibold))
                Text(title)
                    .font(.studioCaptionStrong)
                Text(shortcut)
                    .font(.system(size: 9.5, weight: .semibold, design: .monospaced))
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 3.5)
                    .padding(.vertical, 1)
                    .background(Color.studioFaintFill)
                    .clipShape(RoundedRectangle(cornerRadius: 3, style: .continuous))
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
    }
}
