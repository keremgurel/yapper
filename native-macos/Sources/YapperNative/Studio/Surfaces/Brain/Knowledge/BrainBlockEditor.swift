import SwiftUI

/// The lines inside a list block, added one at a time with Return.
struct BrainListItemsEditor: View {
    let items: [String]
    let onChange: ([String]) -> Void

    @State private var draft = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            ForEach(Array(items.enumerated()), id: \.offset) { index, item in
                HStack(spacing: 8) {
                    Text("\u{2022}").font(.system(size: 12)).foregroundStyle(.secondary)
                    TextField("", text: Binding(
                        get: { item },
                        set: { value in onChange(items.enumerated().map { $0.offset == index ? value : $0.element }) }
                    ))
                    .textFieldStyle(.native)
                    .onSubmit {
                        // An emptied line means delete it.
                        if item.trimmingCharacters(in: .whitespaces).isEmpty { remove(index) }
                    }
                    Button { remove(index) } label: {
                        Image(systemName: "xmark").font(.system(size: 10, weight: .semibold)).foregroundStyle(.secondary).frame(width: 20, height: 20)
                    }
                    .buttonStyle(.studioPlain)
                    .accessibilityLabel("Remove line \(index + 1)")
                }
            }
            HStack(spacing: 8) {
                Image(systemName: "plus").font(.system(size: 11)).foregroundStyle(.secondary)
                TextField("Add a line", text: $draft)
                    .textFieldStyle(.native)
                    .onSubmit(add)
            }
        }
        .frame(maxWidth: 640, alignment: .leading)
    }

    private func add() {
        let text = draft.trimmingCharacters(in: .whitespaces)
        guard !text.isEmpty else { return }
        onChange(items + [text])
        draft = ""
    }

    private func remove(_ index: Int) {
        guard items.indices.contains(index) else { return }
        var next = items
        next.remove(at: index)
        onChange(next)
    }
}
