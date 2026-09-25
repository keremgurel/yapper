import SwiftUI

/// One version of the idea at full width. The left column is the opener in
/// use (hook, title or headline) and the body; the right column scrolls on its
/// own and holds the details, the source, the other openers, the key points
/// and every other block. A long-form adds its chapters; an article its
/// subhead. One column on a narrow window.
struct IdeaCanvasDocumentView<Body: IdeaCanvasBody & ObservableObject, Footer: View>: View {
    /// The idea itself, for the details and the source every tab shares.
    @ObservedObject var store: IdeaCanvasItemStore
    /// The version this tab shows and edits.
    @ObservedObject var version: Body
    let maxWidth: CGFloat
    /// Sends one instruction to Chirpy.
    let ask: (String) -> Void
    /// Aims Chirpy at one block.
    let aim: (IdeaCanvasBlock) -> Void
    @ViewBuilder var footer: () -> Footer

    @Namespace private var hookSpace
    /// The details panel's width, kept between visits.
    @AppStorage("ideaCanvasSideWidth") private var sideWidth = IdeaCanvasSplitHandle.standard
    private let swap = Animation.spring(response: 0.38, dampingFraction: 0.82)

    var body: some View {
        GeometryReader { proxy in
            if proxy.size.width >= 920 {
                HStack(alignment: .top, spacing: 0) {
                    ScrollView { main.padding(.top, 32).padding(.bottom, 120).padding(.trailing, 32) }
                        .scrollIndicators(.automatic)
                    IdeaCanvasSplitHandle(sideWidth: $sideWidth)
                    ScrollView { side.padding(.top, 32).padding(.bottom, 120).padding(.leading, 28) }
                        .scrollIndicators(.never)
                        .frame(width: sideWidth)
                }
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

    private var format: IdeaCanvasVersionFormat { version.format }
    private var hooks: [String] { version.hooks }
    private var keys: [String] { IdeaCanvasText.hookKeys(hooks) }
    private var scriptBlock: IdeaCanvasBlock? { version.blocks.first { $0.kind == .script } }
    private var dekBlock: IdeaCanvasBlock? {
        format == .article ? version.blocks.first { $0.label == IdeaCanvasDoc.dekLabel && !$0.kind.isList } : nil
    }
    private var pointsBlock: IdeaCanvasBlock? {
        version.blocks.first { $0.id != scriptBlock?.id && $0.kind.isList }
    }
    private var otherBlocks: [IdeaCanvasBlock] {
        version.blocks.filter { ![scriptBlock?.id, pointsBlock?.id, dekBlock?.id].contains($0.id) }
    }

    private var main: some View {
        VStack(alignment: .leading, spacing: 48) {
            VStack(alignment: .leading, spacing: 12) {
                IdeaCanvasHookChosen(
                    label: format.openerLabel, askLabel: format.askForOpeners,
                    hook: hooks.first, hookKey: keys.first, namespace: hookSpace,
                    onChange: { version.setHooks([$0] + hooks.dropFirst()) },
                    onAskForHooks: { ask(format.askForOpeners) }
                )
                if format == .article { dek }
            }
            IdeaCanvasScriptEditor(
                label: format.bodyLabel,
                meta: bodyMeta,
                placeholder: placeholder,
                structured: format != .short,
                text: scriptBlock?.text ?? "",
                onChange: { text in version.editBlocks { IdeaCanvasDoc.settingScript(text, in: $0) } },
                onWrite: { ask(format.askToWriteBody) },
                onAsk: { if let scriptBlock { aim(scriptBlock) } else { ask(format.askToWriteBody) } }
            )
            VStack(alignment: .leading, spacing: 24) { footer() }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// The article's one line under the headline, edited in place.
    private var dek: some View {
        IdeaCanvasGrowingEditor(
            text: Binding(
                get: { dekBlock?.text ?? "" },
                set: { text in version.editBlocks { IdeaCanvasDoc.settingDek(text, in: $0) } }
            ),
            placeholder: "One line under the headline: who it's for and what they get.",
            font: .system(size: 17),
            lineSpacing: 4,
            minHeight: 28
        )
        .foregroundStyle(.secondary)
    }

    private var bodyMeta: String? {
        let text = scriptBlock?.text ?? ""
        switch format {
        case .short:
            return nil
        case .long:
            let words = IdeaCanvasChapters.spokenWordCount(text)
            return words > 0 ? "\(words) spoken words · \(IdeaCanvasChapters.runtime(words: words))" : nil
        case .article:
            let words = IdeaCanvasText.wordCount(text)
            return words > 0 ? "\(words) words · \(IdeaCanvasChapters.readingTime(words: words))" : nil
        }
    }

    private var placeholder: String {
        switch format {
        case .short: "The words you will say. Type here, or have Chirpy write a first draft."
        case .long: "The full script. Start a line with ## to mark a chapter, and put visual notes on their own line as [B-ROLL: ...]."
        case .article: "The article. Start a line with ## for a section heading."
        }
    }

    private var side: some View {
        VStack(alignment: .leading, spacing: 40) {
            if let item = store.item {
                IdeaCanvasDetails(item: item, update: store.update)
                if item.sourceUrl != nil || item.sourceTitle != nil {
                    IdeaCanvasSourceCard(item: item)
                }
                IdeaCanvasNoteCard(item: item, update: store.update)
            }
            if format == .long {
                IdeaCanvasChaptersPanel(script: scriptBlock?.text ?? "")
            }
            IdeaCanvasHookAlternatives(
                label: format.alternativesLabel,
                hooks: Array(zip(keys, hooks).dropFirst()).map { (key: $0.0, text: $0.1) },
                namespace: hookSpace,
                onUse: { offset in
                    let index = offset + 1
                    var next = hooks
                    let chosen = next.remove(at: index)
                    withAnimation(swap) { version.setHooks([chosen] + next) }
                },
                onRemove: { offset in
                    var next = hooks
                    next.remove(at: offset + 1)
                    withAnimation(swap) { version.setHooks(next) }
                },
                onMore: { ask(hooks.isEmpty ? format.askForOpeners : format.askForMoreOpeners) }
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
        let blocks = version.blocks
        let index = blocks.firstIndex { $0.id == block.id } ?? 0
        return IdeaCanvasBlockView(
            block: block,
            isFirst: fixedTitle != nil || index == 0,
            isLast: fixedTitle != nil || index == blocks.count - 1,
            fixedTitle: fixedTitle,
            edits: IdeaCanvasBlockEdits(
                change: { change in version.editBlocks { IdeaCanvasDoc.update($0, id: block.id, change) } },
                kind: { kind in version.editBlocks { IdeaCanvasDoc.changeKind($0, id: block.id, to: kind) } },
                move: { direction in withAnimation(.snappy) { version.editBlocks { IdeaCanvasDoc.move($0, id: block.id, by: direction) } } },
                remove: { withAnimation(.snappy) { version.editBlocks { IdeaCanvasDoc.remove($0, id: block.id) } } },
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
