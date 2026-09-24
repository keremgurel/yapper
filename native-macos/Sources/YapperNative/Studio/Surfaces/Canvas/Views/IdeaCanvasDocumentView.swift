import SwiftUI

/// The document at full width. The left column is the hook in use and the
/// script, with the conversation and the origin folded under them; the right
/// column scrolls on its own and holds the details, the other openers, the
/// key points and every other block. One column on a narrow window.
struct IdeaCanvasDocumentView<Footer: View>: View {
    @ObservedObject var store: IdeaCanvasItemStore
    let maxWidth: CGFloat
    /// Sends one instruction to Chirpy.
    let ask: (String) -> Void
    /// Aims Chirpy at one block.
    let aim: (IdeaCanvasBlock) -> Void
    @ViewBuilder var footer: () -> Footer

    @Namespace private var hookSpace
    private let swap = Animation.spring(response: 0.38, dampingFraction: 0.82)

    var body: some View {
        GeometryReader { proxy in
            if proxy.size.width >= 920 {
                HStack(alignment: .top, spacing: 64) {
                    ScrollView { main.padding(.bottom, 120) }
                        .scrollIndicators(.automatic)
                    ScrollView { side.padding(.bottom, 120) }
                        .scrollIndicators(.never)
                        .frame(width: 340)
                }
                .padding(.top, 32)
                .frame(maxWidth: maxWidth)
                .padding(.horizontal, 32)
                .frame(maxWidth: .infinity)
            } else {
                ScrollView {
                    VStack(alignment: .leading, spacing: 48) { main; side }
                        .padding(.top, 32).padding(.bottom, 120).padding(.horizontal, 32)
                }
            }
        }
    }

    private var hooks: [String] { store.hooks }
    private var keys: [String] { IdeaCanvasText.hookKeys(hooks) }
    private var scriptBlock: IdeaCanvasBlock? { store.blocks.first { $0.kind == .script } }
    private var pointsBlock: IdeaCanvasBlock? {
        store.blocks.first { $0.id != scriptBlock?.id && $0.kind.isList }
    }
    private var otherBlocks: [IdeaCanvasBlock] {
        store.blocks.filter { $0.id != scriptBlock?.id && $0.id != pointsBlock?.id }
    }

    private var main: some View {
        VStack(alignment: .leading, spacing: 48) {
            IdeaCanvasHookChosen(
                hook: hooks.first, hookKey: keys.first, namespace: hookSpace,
                onChange: { store.setHooks([$0] + hooks.dropFirst()) },
                onAskForHooks: { ask("Give me five hooks") }
            )
            IdeaCanvasScriptEditor(
                text: scriptBlock?.text ?? "",
                onChange: { text in store.editBlocks { IdeaCanvasDoc.settingScript(text, in: $0) } },
                onWrite: { ask("Write the script") },
                onAsk: { if let scriptBlock { aim(scriptBlock) } else { ask("Write the script") } }
            )
            VStack(alignment: .leading, spacing: 24) { footer() }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var side: some View {
        VStack(alignment: .leading, spacing: 40) {
            if let item = store.item {
                IdeaCanvasDetails(item: item, update: store.update)
                if item.sourceUrl != nil || item.sourceTitle != nil {
                    IdeaCanvasSourceCard(item: item)
                }
            }
            IdeaCanvasHookAlternatives(
                hooks: Array(zip(keys, hooks).dropFirst()).map { (key: $0.0, text: $0.1) },
                namespace: hookSpace,
                onUse: { offset in
                    let index = offset + 1
                    var next = hooks
                    let chosen = next.remove(at: index)
                    withAnimation(swap) { store.setHooks([chosen] + next) }
                },
                onRemove: { offset in
                    var next = hooks
                    next.remove(at: offset + 1)
                    withAnimation(swap) { store.setHooks(next) }
                },
                onMore: {
                    ask(hooks.isEmpty ? "Give me five hooks" : "Give me three more hook alternatives with different angles")
                }
            )
            if let pointsBlock {
                blockView(pointsBlock, fixedTitle: "Key points")
            } else {
                IdeaCanvasEmptySlot(title: "Key points", label: "Give me the key points") {
                    ask("Give me the key points as bullets")
                }
            }
            ForEach(otherBlocks) { blockView($0) }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func blockView(_ block: IdeaCanvasBlock, fixedTitle: String? = nil) -> some View {
        let index = store.blocks.firstIndex { $0.id == block.id } ?? 0
        return IdeaCanvasBlockView(
            block: block,
            isFirst: fixedTitle != nil || index == 0,
            isLast: fixedTitle != nil || index == store.blocks.count - 1,
            fixedTitle: fixedTitle,
            edits: IdeaCanvasBlockEdits(
                change: { change in store.editBlocks { IdeaCanvasDoc.update($0, id: block.id, change) } },
                kind: { kind in store.editBlocks { IdeaCanvasDoc.changeKind($0, id: block.id, to: kind) } },
                move: { direction in withAnimation(.snappy) { store.editBlocks { IdeaCanvasDoc.move($0, id: block.id, by: direction) } } },
                remove: { withAnimation(.snappy) { store.editBlocks { IdeaCanvasDoc.remove($0, id: block.id) } } },
                ask: { aim(block) }
            )
        )
    }
}

/// A part with nothing in it yet: its name, and the one ask that fills it.
struct IdeaCanvasEmptySlot: View {
    let title: String
    let label: String
    let action: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            IdeaCanvasSectionTitle(title)
            Button(action: action) { IdeaCanvasChirpyLabel(label) }
                .buttonStyle(EditorGhostButtonStyle(size: .small))
                .foregroundStyle(.secondary)
        }
    }
}
