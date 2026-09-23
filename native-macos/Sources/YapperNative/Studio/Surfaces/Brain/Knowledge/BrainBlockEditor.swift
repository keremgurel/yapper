import SwiftUI

/// One section, open. The digest sits above the contents because it is the
/// part that is always in the prompt, and the contents usually are not.
struct BrainBlockEditor: View {
    let block: BrainBlock
    let onEdit: (BrainBlockEdit) -> Void

    @State private var tagsText = ""
    @FocusState private var tagsFocused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            TextField("Call it whatever you call it", text: Binding(get: { block.title }, set: { onEdit(.title($0)) }))
                .textFieldStyle(.plain)
                .font(.system(size: 14, weight: .medium))
                .frame(maxWidth: 560, alignment: .leading)

            NativeField(label: "What this is, in one line") {
                VStack(alignment: .leading, spacing: 4) {
                    TextField("Search terms with thin answers, use when picking a topic", text: Binding(get: { block.digest }, set: { onEdit(.digest($0)) }))
                        .textFieldStyle(.native)
                        .frame(maxWidth: 560)
                    Text("The only part of this section that is in every prompt. Say when it matters, not just what it is.")
                        .font(.system(size: 11)).foregroundStyle(.secondary)
                }
            }

            contents

            HStack(alignment: .top, spacing: 16) {
                NativeField(label: "Tags") {
                    TextField("pricing, objections", text: $tagsText)
                        .textFieldStyle(.native)
                        .focused($tagsFocused)
                        .onSubmit(commitTags)
                }
                NativeField(label: "Where it came from") {
                    TextField("TikTok Creator Search Insights", text: Binding(get: { block.sourceLabel }, set: { onEdit(.sourceLabel($0)) }))
                        .textFieldStyle(.native)
                }
            }
        }
        .onAppear { tagsText = block.tags.joined(separator: ", ") }
        .onChange(of: tagsFocused) { _, focused in if !focused { commitTags() } }
        .onDisappear(perform: commitTags)
    }

    @ViewBuilder
    private var contents: some View {
        switch block.kind {
        case .list:
            BrainListItemsEditor(items: block.items) { onEdit(.items($0)) }
        case .table:
            BrainTableEditor(table: block.rows ?? BrainTable(columns: [], rows: [])) { onEdit(.rows($0)) }
        case .doc:
            VStack(alignment: .leading, spacing: 6) {
                NativeTextArea(
                    text: Binding(get: { block.body }, set: { onEdit(.body($0)) }),
                    placeholder: "Paste the document. All of it is kept.",
                    font: .system(size: 13, design: .monospaced),
                    minHeight: 240
                )
                .frame(maxWidth: 640)
                Text(block.body.utf16.count > 1_500
                     ? "Kept whole, read in pieces. Only the parts about what you are writing go into a prompt."
                     : "Short enough to be read in one piece.")
                    .font(.system(size: 11)).foregroundStyle(.secondary)
            }
        case .note:
            NativeTextArea(
                text: Binding(get: { block.body }, set: { onEdit(.body($0)) }),
                placeholder: "Write it the way you would say it.",
                font: .system(size: 14),
                minHeight: 110
            )
            .frame(maxWidth: 640)
        }
    }

    private func commitTags() {
        let tags = brainParseTags(tagsText)
        if tags != block.tags { onEdit(.tags(tags)) }
    }
}

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
