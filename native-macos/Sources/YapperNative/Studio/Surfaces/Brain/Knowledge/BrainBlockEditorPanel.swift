import SwiftUI

/// One knowledge section, open in the editor panel. The one-line summary and
/// the settings sit on the left; the section itself fills the rest.
struct BrainBlockEditorPanel: View {
    let blockID: String
    let onClose: () -> Void
    @ObservedObject private var store = BrainBlocksStore.shared

    @State private var tagsText = ""
    @FocusState private var tagsFocused: Bool

    var body: some View {
        if let block = store.blocks?.first(where: { $0.id == blockID }) {
            BrainEditorPanel(
                title: block.title.isEmpty ? "Untitled section" : block.title,
                description: "\(block.shapeDescription) \u{00B7} \(block.sizeLabel)",
                onClose: onClose
            ) {
                side(block)
            } main: {
                main(block)
            }
            .onAppear { tagsText = block.tags.joined(separator: ", ") }
            .onChange(of: tagsFocused) { _, focused in if !focused { commitTags(block) } }
            .onDisappear { commitTags(block) }
        } else {
            BrainEditorPanel(title: "Knowledge", onClose: onClose) {
                Text("This section isn't here anymore.").font(.system(size: 13)).foregroundStyle(.secondary)
            } main: { EmptyView() }
        }
    }

    @ViewBuilder
    private func side(_ block: BrainBlock) -> some View {
        NativeField(label: "Name") {
            TextField("Call it whatever you call it", text: Binding(get: { block.title }, set: { store.edit(block.id, .title($0)) }))
                .textFieldStyle(.native)
        }
        NativeField(label: "What this is, in one line") {
            VStack(alignment: .leading, spacing: 4) {
                NativeTextArea(
                    text: Binding(get: { block.digest }, set: { store.edit(block.id, .digest($0)) }),
                    placeholder: "Search terms with thin answers, use when picking a topic",
                    font: .system(size: 13),
                    minHeight: 54
                )
                Text("The only part of this section in every prompt. Say when it matters, not just what it is.")
                    .font(.system(size: 11)).foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        NativeField(label: "How it is read") {
            BrainUsageMenu(usage: block.usage) { store.edit(block.id, .usage($0)) }
        }
        NativeField(label: "Tags") {
            TextField("pricing, objections", text: $tagsText)
                .textFieldStyle(.native)
                .focused($tagsFocused)
                .onSubmit { commitTags(block) }
        }
        NativeField(label: "Where it came from") {
            TextField("TikTok Creator Search Insights", text: Binding(get: { block.sourceLabel }, set: { store.edit(block.id, .sourceLabel($0)) }))
                .textFieldStyle(.native)
        }
    }

    @ViewBuilder
    private func main(_ block: BrainBlock) -> some View {
        switch block.kind {
        case .note, .doc:
            BrainLongTextEditor(
                text: Binding(get: { block.body }, set: { store.edit(block.id, .body($0)) }),
                placeholder: block.kind == .doc ? "Paste the document. All of it is kept." : "Write it the way you would say it."
            )
            if block.kind == .doc {
                Text(block.body.utf16.count > 1_500
                     ? "Kept whole, read in pieces. Only the parts about what you are writing go into a prompt."
                     : "Short enough to be read in one piece.")
                    .font(.system(size: 11)).foregroundStyle(.secondary)
            }
        case .list:
            ScrollView {
                BrainListItemsEditor(items: block.items) { store.edit(block.id, .items($0)) }
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        case .table:
            ScrollView {
                BrainTableEditor(table: block.rows ?? BrainTable(columns: [], rows: [])) { store.edit(block.id, .rows($0)) }
            }
        }
    }

    private func commitTags(_ block: BrainBlock) {
        let tags = brainParseTags(tagsText)
        if tags != block.tags { store.edit(block.id, .tags(tags)) }
    }
}
