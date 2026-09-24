import SwiftUI

/// One palette color, labelled with its role. Clicking the color opens the
/// picker right beside it; the change saves when the picker closes. Drag a
/// swatch onto another to swap roles.
struct BrandColorSwatch: View {
    let color: String
    let role: BrandColorRole
    let busy: Bool
    /// Taking out a middle role would shift every later color into a new
    /// role, so only accents and the last color can go.
    let removable: Bool
    let onChange: (String) -> Void
    let onDelete: () -> Void

    @State private var draft = ""
    @State private var picking = false

    var body: some View {
        VStack(spacing: 0) {
            Button { picking = true } label: {
                BrandHex.color(BrandHex.normalize(draft) ?? color)
                    .frame(height: 96)
                    .overlay(alignment: .topLeading) {
                        NativeChip(text: role.title, tone: role == .primary ? .orange : .neutral).padding(10)
                    }
                    .contentShape(Rectangle())
            }
            .buttonStyle(.studioPlain)
            .clickableCursor(enabled: !busy)
            .help("Change \(role.title.lowercased()) color")
            .popover(isPresented: $picking, arrowEdge: .bottom) {
                BrandColorPicker(role: role, hex: $draft)
            }
            Rectangle().fill(Color.studioLine).frame(height: 1)
            HStack(spacing: 4) {
                TextField("#RRGGBB", text: $draft)
                    .textFieldStyle(.plain)
                    .font(.system(size: 12, weight: .medium).monospaced())
                    .onSubmit(commitDraft)
                    .accessibilityLabel("Hex value for \(role.title.lowercased()) color")
                Spacer(minLength: 0)
                if removable {
                    BrandConfirmDeleteButton(label: "Remove \(color)", onConfirm: onDelete)
                }
            }
            .frame(height: 30)
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
        }
        .disabled(busy)
        .background(Color.panelBackground)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(Color.studioLine, lineWidth: 1))
        .onAppear { draft = color }
        .onChange(of: color) { _, saved in draft = saved }
        .onChange(of: picking) { _, open in if !open { commitDraft() } }
    }

    private func commitDraft() {
        guard let next = BrandHex.normalize(draft) else {
            draft = color
            return
        }
        if next != color { onChange(next) }
        // The server's answer replaces `color`; until then show the saved one
        // if the save fails.
        draft = next
    }
}
