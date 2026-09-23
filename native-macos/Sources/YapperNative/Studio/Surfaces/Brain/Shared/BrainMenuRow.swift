import SwiftUI

/// One choice in a Brain popover menu: an optional icon or check, a title,
/// an optional line of help, and a trailing note.
struct BrainMenuRow: View {
    var systemImage: String?
    var checked: Bool?
    let title: String
    var help: String?
    var trailing: String?
    let action: () -> Void

    @State private var hovering = false

    var body: some View {
        Button(action: action) {
            HStack(alignment: help == nil ? .center : .top, spacing: 8) {
                if let checked {
                    Image(systemName: "checkmark")
                        .font(.system(size: 11, weight: .semibold))
                        .opacity(checked ? 1 : 0)
                        .frame(width: 14)
                        .padding(.top, help == nil ? 0 : 2)
                } else if let systemImage {
                    Image(systemName: systemImage).font(.system(size: 13)).foregroundStyle(.secondary).frame(width: 18)
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).font(.system(size: 13, weight: help == nil ? .regular : .medium))
                    if let help {
                        Text(help).font(.system(size: 12)).foregroundStyle(.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                Spacer(minLength: 8)
                if let trailing {
                    Text(trailing).font(.system(size: 12)).foregroundStyle(.secondary)
                }
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 7)
            .background(RoundedRectangle(cornerRadius: 6, style: .continuous).fill(hovering ? Color.studioFaintFill : .clear))
        }
        .buttonStyle(.studioPlain)
        .onHover { hovering = $0 }
    }
}
