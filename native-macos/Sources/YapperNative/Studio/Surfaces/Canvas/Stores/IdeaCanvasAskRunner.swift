import Foundation

/// Runs one ask at a time against the canvas and applies what comes back,
/// as the web canvas's `askFromChirpy` does: the reply's actions land on the
/// document through the item's one writer, the exchange goes into the thread,
/// and the newest change can be taken back.
@MainActor
final class IdeaCanvasAskRunner: ObservableObject {
    /// The canvas as it was before the newest reply that changed it.
    struct Undo: Equatable {
        let messageID: String?
        let state: IdeaCanvasState
    }

    @Published private(set) var busy = false
    @Published private(set) var error: IdeaCanvasAskError?
    /// What Chirpy said last, for the ask bar.
    @Published private(set) var lastReply: String?
    @Published private(set) var undo: Undo?
    /// Replies already put on the page, so "Add to page" is offered once.
    @Published private(set) var addedIDs: Set<String> = []

    private let store: IdeaCanvasItemStore
    private let thread: IdeaCanvasThreadStore

    init(store: IdeaCanvasItemStore, thread: IdeaCanvasThreadStore) {
        self.store = store
        self.thread = thread
    }

    func run(_ instruction: String, targetID: String? = nil) async {
        let trimmed = instruction.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !busy, !trimmed.isEmpty, let item = store.item else { return }
        busy = true
        error = nil
        lastReply = nil
        defer { busy = false }

        let blocks = store.blocks
        let before = IdeaCanvasState(title: item.title, blocks: blocks, hooks: item.hooks)
        let target = targetID.flatMap { id in blocks.firstIndex { $0.id == id } }
        let context = IdeaCanvasAskContext(
            title: item.title, blocks: blocks, hooks: item.hooks, originalNote: item.originalNote,
            sourceTitle: item.sourceTitle, sourceURL: item.sourceUrl,
            sourceExcerpt: item.sourceTranscript ?? item.sourceSummary ?? ""
        )
        let pendingID = thread.pendingAsk(trimmed)
        let body = IdeaCanvasAskBody(instruction: trimmed, context: context, target: target, contentID: item.id)

        switch await IdeaCanvasAskClient.ask(body, blockCount: blocks.count) {
        case .failure(let failure):
            thread.settle(pendingID, saved: nil)
            error = failure
        case .success(let reply):
            apply(reply, before: before)
            thread.settle(pendingID, saved: reply.messages)
            let said = reply.chirpyMessage?.text
            let changed = reply.actions.isEmpty ? nil : IdeaCanvasActions.describe(reply.actions)
            lastReply = [said, changed, reply.note].compactMap { $0 }.first { !$0.isEmpty } ?? "Done."
            undo = reply.actions.isEmpty ? nil : Undo(messageID: reply.chirpyMessage?.id, state: before)
        }
    }

    func undoLast() {
        guard let undo, let item = store.item else { return }
        store.setBlocks(undo.state.blocks)
        store.setHooks(undo.state.hooks)
        if undo.state.title != item.title { store.update(IdeaCanvasPatch(title: undo.state.title)) }
        self.undo = nil
        lastReply = "Undone."
    }

    /// Puts an answer that changed nothing onto the page as its own block.
    func addToPage(_ message: IdeaCanvasMessage, asked: String) {
        let block = IdeaCanvasBlock(input: IdeaCanvasNoteToBlock.block(note: message.text, asked: asked))
        store.editBlocks { $0 + [block] }
        addedIDs.insert(message.id)
    }

    func dismissError() { error = nil }

    private func apply(_ reply: IdeaCanvasAskReply, before: IdeaCanvasState) {
        let next = IdeaCanvasActions.apply(before, reply.actions)
        if next.blocks != before.blocks { store.setBlocks(next.blocks) }
        if next.hooks != before.hooks { store.setHooks(next.hooks) }
        if next.title != before.title { store.update(IdeaCanvasPatch(title: next.title)) }
    }
}
