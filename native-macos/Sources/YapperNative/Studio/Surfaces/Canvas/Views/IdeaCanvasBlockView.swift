import SwiftUI

/// What a block can do, handed down by the document.
struct IdeaCanvasBlockEdits {
    let change: ((inout IdeaCanvasBlock) -> Void) -> Void
    let kind: (IdeaCanvasBlockKind) -> Void
    let move: (Int) -> Void
    let remove: () -> Void
    let ask: () -> Void
}

/// One block: a label you name, and its words. Controls (ask, kind, move,
/// remove) appear on hover. A list shows as a list until clicked, then edits
/// one item per line.
struct IdeaCanvasBlockView: View {
    let block: IdeaCanvasBlock
    let isFirst: Bool
    let isLast: Bool
    /// A slot with a fixed name (Key points): no renaming, kind or moving.
    var fixedTitle: String?
    let edits: IdeaCanvasBlockEdits

    @State private var hovering = false
    @State private var editing = false
    @State private var focusRequest = 0

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            IdeaCanvasSectionTitle(title: { title }, meta: nil) {
                HStack(spacing: 2) { controls }.opacity(hovering || editing ? 1 : 0)
            }
            if showsRenderedList {
                Button {
                    editing = true
                    focusRequest += 1
                } label: { IdeaCanvasRenderedList(block: block) }
                .buttonStyle(.studioPlain)
                .help("Edit")
            } else {
                IdeaCanvasGrowingEditor(
                    text: Binding(get: { value }, set: { write($0) }),
                    placeholder: placeholder,
                    font: .system(size: block.kind == .script ? 17 : 15),
                    lineSpacing: block.kind == .script ? 9 : 5,
                    minHeight: block.kind == .script ? 120 : 56,
                    focusRequest: focusRequest,
                    onFocusChange: { if !$0 { editing = false } }
                )
            }
        }
        .contentShape(Rectangle())
        .onHover { hovering = $0 }
    }

    @ViewBuilder private var title: some View {
        if let fixedTitle {
            Text(fixedTitle)
        } else {
            TextField("Name this part", text: Binding(get: { block.label }, set: { label in edits.change { $0.label = label } }))
                .textFieldStyle(.plain)
        }
    }

    @ViewBuilder private var controls: some View {
        IdeaCanvasAskChip { edits.ask() }
        if fixedTitle == nil {
            Picker("", selection: Binding(get: { block.kind }, set: { kind in edits.kind(kind) })) {
                ForEach(IdeaCanvasBlockKind.allCases) { Text($0.label).tag($0) }
            }
            .labelsHidden()
            .pickerStyle(.menu)
            .controlSize(.small)
            .fixedSize()
            .clickableCursor()
            iconButton("chevron.up", help: "Move up", disabled: isFirst) { edits.move(-1) }
            iconButton("chevron.down", help: "Move down", disabled: isLast) { edits.move(1) }
        }
        iconButton("xmark", help: "Remove this part", disabled: false) { edits.remove() }
    }

    private func iconButton(_ symbol: String, help: String, disabled: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) { Image(systemName: symbol).font(.system(size: 11, weight: .semibold)) }
            .buttonStyle(EditorGhostButtonStyle(size: .mini))
            .foregroundStyle(.secondary)
            .disabled(disabled)
            .help(help)
    }

    private var showsRenderedList: Bool {
        block.kind.isList && !editing && block.items.contains { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
    }

    private var value: String { block.kind.isList ? block.items.joined(separator: "\n") : block.text }

    private func write(_ text: String) {
        if block.kind.isList {
            let items = text.split(separator: "\n", omittingEmptySubsequences: false)
                .map { String($0.drop(while: { $0.isWhitespace })) }
            edits.change { $0.items = items }
        } else {
            edits.change { $0.text = text }
        }
    }

    private var placeholder: String {
        switch block.kind {
        case .script: "The words you will say, or ask Chirpy."
        case .bullets, .steps: "One per line"
        case .paragraph: "Write here, or ask Chirpy."
        }
    }
}

/// A list block at rest: bullets or numbered steps.
private struct IdeaCanvasRenderedList: View {
    let block: IdeaCanvasBlock

    var body: some View {
        let items = block.items.filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
        VStack(alignment: .leading, spacing: 6) {
            ForEach(Array(items.enumerated()), id: \.offset) { index, item in
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text(block.kind == .steps ? "\(index + 1)." : "\u{2022}")
                        .foregroundStyle(.secondary)
                        .frame(minWidth: 14, alignment: .trailing)
                    Text(item).frame(maxWidth: .infinity, alignment: .leading).multilineTextAlignment(.leading)
                }
            }
        }
        .font(.system(size: 15))
        .lineSpacing(4)
        .foregroundStyle(Color.primary.opacity(0.9))
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
