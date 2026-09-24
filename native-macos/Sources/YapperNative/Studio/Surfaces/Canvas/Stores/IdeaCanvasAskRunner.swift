import Foundation

/// Runs one ask at a time against the canvas and applies what comes back,
/// as the web canvas's `askFromChirpy` does: the reply's actions land on the
/// document through the item's one writer, the exchange goes into the thread,
/// and the newest change can be taken back.
@MainActor
final class IdeaCanvasAskRunner: ObservableObject {
    /// The canvas as it was before the newest reply that changed it.
    struct Undo {
        let messageID: String?
        let state: IdeaCanvasState
        /// The version the reply changed, which may no longer be on screen.
        let body: IdeaCanvasBody
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
    /// The version on screen. Asks read and change it, and only it, so an
    /// edit on the long-form tab never touches the short.
    var body: IdeaCanvasBody

    init(store: IdeaCanvasItemStore, thread: IdeaCanvasThreadStore) {
        self.store = store
        self.thread = thread
        body = store
    }

    func run(_ instruction: String, targetID: String? = nil) async {
        let trimmed = instruction.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !busy, !trimmed.isEmpty, let item = store.item else { return }
        busy = true
        error = nil
        lastReply = nil
        defer { busy = false }

        let edited = self.body
        let blocks = edited.blocks
        let before = IdeaCanvasState(title: item.title, blocks: blocks, hooks: edited.hooks)
        let target = targetID.flatMap { id in blocks.firstIndex { $0.id == id } }
        let context = IdeaCanvasAskContext(
            title: item.title, blocks: blocks, hooks: edited.hooks, originalNote: item.originalNote,
            sourceTitle: item.sourceTitle, sourceURL: item.sourceUrl,
            sourceExcerpt: item.sourceTranscript ?? item.sourceSummary ?? "",
            format: edited.format
        )
        let pendingID = thread.pendingAsk(trimmed)
        let body = IdeaCanvasAskBody(instruction: trimmed, context: context, target: target, contentID: item.id)

        switch await IdeaCanvasAskClient.ask(body, blockCount: blocks.count) {
        case .failure(let failure):
            thread.settle(pendingID, saved: nil)
            error = failure
        case .success(let reply):
            apply(reply, before: before, to: edited)
            thread.settle(pendingID, saved: reply.messages)
            let said = reply.chirpyMessage?.text
            let changed = reply.actions.isEmpty ? nil : IdeaCanvasActions.describe(reply.actions)
            lastReply = [said, changed, reply.note].compactMap { $0 }.first { !$0.isEmpty } ?? "Done."
            undo = reply.actions.isEmpty ? nil : Undo(messageID: reply.chirpyMessage?.id, state: before, body: edited)
        }
    }

    func undoLast() {
        guard let undo, let item = store.item else { return }
        undo.body.setBlocks(undo.state.blocks)
        undo.body.setHooks(undo.state.hooks)
        if undo.state.title != item.title { store.update(IdeaCanvasPatch(title: undo.state.title)) }
        self.undo = nil
        lastReply = "Undone."
    }

    /// Puts an answer that changed nothing onto the page as its own block.
    func addToPage(_ message: IdeaCanvasMessage, asked: String) {
        let block = IdeaCanvasBlock(input: IdeaCanvasNoteToBlock.block(note: message.text, asked: asked))
        body.editBlocks { $0 + [block] }
        addedIDs.insert(message.id)
    }

    func dismissError() { error = nil }

    private func apply(_ reply: IdeaCanvasAskReply, before: IdeaCanvasState, to body: IdeaCanvasBody) {
        let next = IdeaCanvasActions.apply(before, reply.actions)
        if next.blocks != before.blocks { body.setBlocks(next.blocks) }
        if next.hooks != before.hooks { body.setHooks(next.hooks) }
        if next.title != before.title { store.update(IdeaCanvasPatch(title: next.title)) }
    }
}
