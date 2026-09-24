import SwiftUI

/// The next empty role in the palette as a dashed card, the same size as a
/// swatch. Clicking it opens the picker on a suggested color with an Add
/// button.
struct BrandAddColorCard: View {
    let role: BrandColorRole
    let existing: [String]
    let busy: Bool
    let onAdd: (String) -> Void

    @State private var draft = ""
    @State private var picking = false

    private var duplicate: Bool { existing.contains(draft) }

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: 12, style: .continuous)
        Button {
            draft = role.suggestion(avoiding: existing)
            picking = true
        } label: {
            VStack(spacing: 6) {
                Image(systemName: "plus").font(.system(size: 14, weight: .semibold)).foregroundStyle(.secondary)
                Text("Add \(role.title.lowercased())").font(.system(size: 13, weight: .semibold))
                Text(role.hint).font(.system(size: 11)).foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.horizontal, 16)
            .frame(maxWidth: .infinity)
            .frame(height: 135)
            .background(shape.fill(Color.studioFaintFill))
            .overlay(shape.strokeBorder(Color.studioLineStrong, style: StrokeStyle(lineWidth: 1, dash: [4, 3])))
            .contentShape(shape)
        }
        .buttonStyle(.studioPlain)
        .clickableCursor(enabled: !busy)
        .disabled(busy)
        .popover(isPresented: $picking, arrowEdge: .bottom) {
            BrandColorPicker(
                role: role,
                hex: $draft,
                confirm: (duplicate ? "Already in your palette" : "Add \(role.title.lowercased())", add)
            )
        }
    }

    private func add() {
        guard !duplicate, let color = BrandHex.normalize(draft) else { return }
        picking = false
        onAdd(color)
    }
}
