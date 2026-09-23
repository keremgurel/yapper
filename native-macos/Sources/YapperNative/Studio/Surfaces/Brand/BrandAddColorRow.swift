import SwiftUI

/// Adds a color: the system color well and a hex field side by side, both
/// editing the same draft, which starts on the next suggested color.
struct BrandAddColorRow: View {
    let existing: [String]
    let disabled: Bool
    let onAdd: (String) -> Void

    @State private var draft = ""

    private var normalized: String? { BrandHex.normalize(draft) }
    private var canAdd: Bool { !disabled && normalized.map { !existing.contains($0) } == true }

    var body: some View {
        HStack(spacing: 8) {
            ColorPicker("New color", selection: Binding(
                get: { BrandHex.color(normalized ?? "#FF7A21") },
                set: { draft = BrandHex.hex($0) }
            ), supportsOpacity: false)
            .labelsHidden()
            TextField("#RRGGBB", text: $draft)
                .textFieldStyle(.native)
                .font(.system(size: 13).monospaced())
                .frame(width: 120)
                .onSubmit(add)
            Button("Add color", systemImage: "plus", action: add)
                .buttonStyle(EditorSecondaryButtonStyle(size: .small))
                .disabled(!canAdd)
            if !draft.isEmpty && normalized == nil {
                Text("Use a hex value like #FF7A21.").font(.system(size: 12)).foregroundStyle(.secondary)
            } else if let normalized, existing.contains(normalized) {
                Text("That color is already in your palette.").font(.system(size: 12)).foregroundStyle(.secondary)
            }
        }
        .onAppear(perform: suggest)
        .onChange(of: existing) { _, _ in suggest() }
    }

    private func add() {
        guard canAdd, let normalized else { return }
        onAdd(normalized)
    }

    private func suggest() {
        if draft.isEmpty || normalized.map(existing.contains) == true {
            draft = BrandHex.next(after: existing) ?? ""
        }
    }
}
