import Foundation

/// The canvas document: pure edits on the block list, ported from
/// `lib/content/canvas-doc.ts`. The first script block is what the recorder
/// reads, so it is mirrored into the item's `script` on every save.
enum IdeaCanvasDoc {
    static let scriptLabel = "Script"

    /// The document for an item. A stored script becomes a script block when
    /// the body has none, so older scripts show up where they belong.
    static func blocks(from stored: [IdeaCanvasStoredBlock], script: String?) -> [IdeaCanvasBlock] {
        var blocks = stored.map(IdeaCanvasBlock.init(stored:))
        let trimmed = script?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if !trimmed.isEmpty, !blocks.contains(where: { $0.kind == .script }) {
            blocks.insert(IdeaCanvasBlock(label: scriptLabel, kind: .script, text: script ?? ""), at: 0)
        }
        return blocks
    }

    /// What the recorder will read: the first script block, or nothing.
    static func script(of blocks: [IdeaCanvasBlock]) -> String? {
        guard let block = blocks.first(where: { $0.kind == .script }) else { return nil }
        return block.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : block.text
    }

    /// The persisted shape: blocks without their ids, plus the mirrored script.
    static func patch(from blocks: [IdeaCanvasBlock]) -> IdeaCanvasPatch {
        IdeaCanvasPatch(
            blocks: blocks.map { block in
                block.kind.isList
                    ? IdeaCanvasStoredBlock(label: block.label, kind: block.kind.rawValue, items: block.items)
                    : IdeaCanvasStoredBlock(label: block.label, kind: block.kind.rawValue, text: block.text)
            },
            script: IdeaCanvasNullable(script(of: blocks))
        )
    }

    static func update(_ blocks: [IdeaCanvasBlock], id: String, _ change: (inout IdeaCanvasBlock) -> Void) -> [IdeaCanvasBlock] {
        blocks.map { block in
            guard block.id == id else { return block }
            var next = block
            change(&next)
            return next
        }
    }

    /// Changing kind keeps the words: lines become items and items become lines.
    static func changeKind(_ blocks: [IdeaCanvasBlock], id: String, to kind: IdeaCanvasBlockKind) -> [IdeaCanvasBlock] {
        update(blocks, id: id) { block in
            guard block.kind != kind else { return }
            let wasList = block.kind.isList
            block.kind = kind
            if wasList == kind.isList { return }
            if kind.isList {
                block.items = block.text.split(separator: "\n", omittingEmptySubsequences: false)
                    .map { $0.trimmingCharacters(in: .whitespaces) }
                    .filter { !$0.isEmpty }
            } else {
                block.text = block.items.filter { !$0.isEmpty }.joined(separator: "\n")
            }
        }
    }

    static func move(_ blocks: [IdeaCanvasBlock], id: String, by direction: Int) -> [IdeaCanvasBlock] {
        guard let index = blocks.firstIndex(where: { $0.id == id }) else { return blocks }
        let target = index + direction
        guard blocks.indices.contains(target) else { return blocks }
        var next = blocks
        next.swapAt(index, target)
        return next
    }

    static func remove(_ blocks: [IdeaCanvasBlock], id: String) -> [IdeaCanvasBlock] {
        blocks.filter { $0.id != id }
    }

    static func insert(_ block: IdeaCanvasBlock, after anchor: String?, in blocks: [IdeaCanvasBlock]) -> [IdeaCanvasBlock] {
        guard let anchor else { return [block] + blocks }
        guard let index = blocks.firstIndex(where: { $0.id == anchor }) else { return blocks + [block] }
        var next = blocks
        next.insert(block, at: index + 1)
        return next
    }

    /// Sets the script's words, making a script block first if there is none.
    static func settingScript(_ text: String, in blocks: [IdeaCanvasBlock]) -> [IdeaCanvasBlock] {
        if let existing = blocks.first(where: { $0.kind == .script }) {
            return update(blocks, id: existing.id) { $0.text = text }
        }
        return [IdeaCanvasBlock(label: scriptLabel, kind: .script, text: text)] + blocks
    }
}
