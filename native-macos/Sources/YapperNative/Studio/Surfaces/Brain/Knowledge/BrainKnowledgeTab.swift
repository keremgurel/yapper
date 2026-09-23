import SwiftUI

/// The Knowledge tab: the list of what Yapper knows, with one Add action.
struct BrainKnowledgeTab: View {
    let onAdd: () -> Void
    @ObservedObject private var store = BrainBlocksStore.shared

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            HStack(alignment: .bottom, spacing: 16) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Knowledge").font(.nativeSectionTitle)
                    Text("Research, stories, examples, and rules Yapper pulls in when they matter.")
                        .font(.system(size: 13)).foregroundStyle(.secondary)
                }
                Spacer(minLength: 0)
                Button(action: onAdd) { Label("Add knowledge", systemImage: "plus") }
                    .buttonStyle(EditorPrimaryButtonStyle())
                    .disabled(!store.available)
            }
            VStack(alignment: .leading, spacing: 12) {
                if store.saveState == .error {
                    BrainInlineError(message: "A memory could not be saved. Your next edit retries it.")
                }
                if let blocks = store.blocks {
                    BrainBlockList(blocks: blocks, store: store)
                } else if store.loading {
                    NativeLoadingState(label: "Loading Knowledge…")
                } else {
                    Text("Your Knowledge will appear after it loads successfully.")
                        .font(.system(size: 13)).foregroundStyle(.secondary).padding(.vertical, 12)
                }
            }
            .nativeCard(padding: 16)
        }
    }
}

/// Everything the creator has written or imported, as one list, filterable
/// by tag or by text. Reordering is off while a filter is on, because moving
/// a row of a filtered view has no honest meaning in the full order.
struct BrainBlockList: View {
    let blocks: [BrainBlock]
    @ObservedObject var store: BrainBlocksStore

    @State private var openID: String?
    @State private var tag: String?
    @State private var query = ""

    var body: some View {
        if blocks.isEmpty {
            NativeEmptyState(
                systemImage: "square.stack.3d.up",
                title: "Nothing in here yet",
                message: "Add a section, or paste something you already researched. Everything Yapper writes reads this first."
            )
        } else {
            VStack(alignment: .leading, spacing: 12) {
                if !topTags.isEmpty || blocks.count > 6 { toolbar }
                VStack(spacing: 0) {
                    ForEach(Array(rows.enumerated()), id: \.element.id) { index, block in
                        if index > 0 { Rectangle().fill(Color.studioLine).frame(height: 1) }
                        BrainBlockRow(
                            block: block,
                            open: openID == block.id,
                            canReorder: !filtering,
                            position: blocks.firstIndex { $0.id == block.id } ?? 0,
                            total: blocks.count,
                            store: store,
                            onToggle: { openID = openID == block.id ? nil : block.id }
                        )
                    }
                    if rows.isEmpty {
                        Text("Nothing matches that.")
                            .font(.system(size: 13)).foregroundStyle(.secondary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(16)
                    }
                }
                .background(RoundedRectangle(cornerRadius: 10, style: .continuous).strokeBorder(Color.studioLine))
            }
        }
    }

    private var toolbar: some View {
        HStack(alignment: .center, spacing: 12) {
            BrainFlowLayout {
                ForEach(topTags, id: \.self) { value in
                    BrainToggleChip(text: value, on: tag == value) { tag = tag == value ? nil : value }
                }
            }
            Spacer(minLength: 0)
            TextField("Find a section", text: $query)
                .textFieldStyle(.native)
                .frame(width: 180)
        }
    }

    private var filtering: Bool { tag != nil || !needle.isEmpty }
    private var needle: String { query.trimmingCharacters(in: .whitespaces).lowercased() }

    private var rows: [BrainBlock] {
        blocks.filter { block in
            if let tag, !block.tags.contains(tag) { return false }
            guard !needle.isEmpty else { return true }
            return "\(block.title) \(block.digest) \(block.tags.joined(separator: " "))".lowercased().contains(needle)
        }
    }

    /// The eight most used tags.
    private var topTags: [String] {
        var counts: [String: Int] = [:]
        for block in blocks { for value in block.tags { counts[value, default: 0] += 1 } }
        return counts.sorted { $0.value != $1.value ? $0.value > $1.value : $0.key < $1.key }.prefix(8).map(\.key)
    }
}
