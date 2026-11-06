import Foundation

extension Notification.Name {
    /// Posted with the item id as `object` after the canvas saves or deletes
    /// an idea, so a list showing it can refresh.
    static let ideaCanvasDidSave = Notification.Name("IdeaCanvasDidSave")
    static let ideaCanvasDidDelete = Notification.Name("IdeaCanvasDidDelete")
    /// Posted when Chirpy changed a canvas on the server from another tab,
    /// so an open canvas reloads its document and conversation.
    static let ideaCanvasChangedRemotely = Notification.Name("IdeaCanvasChangedRemotely")
}

/// One idea on the canvas: the loaded row, its blocks with client ids, and
/// the single writer every edit goes through (`update`), which feeds the
/// autosave. Chirpy's changes go through the same writer. Saves carry the
/// copy they started from (`sync`), so one landing after a change made
/// elsewhere is merged rather than replacing it.
@MainActor
final class IdeaCanvasItemStore: ObservableObject {
    enum Phase: Equatable { case loading, loaded, missing, failed }

    /// Items seen this session, so reopening one paints at once.
    private static var cache: [String: IdeaCanvasItem] = [:]

    let itemID: String
    let sync: IdeaCanvasSync
    let autosave: IdeaCanvasAutosave
    @Published private(set) var item: IdeaCanvasItem?
    @Published private(set) var blocks: [IdeaCanvasBlock] = []
    @Published private(set) var phase: Phase = .loading

    /// `transport` and `loaded` let tests drive the store without the network.
    init(itemID: String, transport: IdeaCanvasSync.Transport? = nil, loaded: IdeaCanvasItem? = nil) {
        self.itemID = itemID
        let path = "api/content/\(itemID)"
        let sync = transport.map { IdeaCanvasSync(path: path, method: "PATCH", itemID: itemID, transport: $0) }
            ?? IdeaCanvasSync(path: path, method: "PATCH", itemID: itemID)
        self.sync = sync
        autosave = IdeaCanvasAutosave { patch in try await sync.save(patch) }
        sync.latest = { [weak self] in self?.item.map(Self.fields) ?? IdeaCanvasPatch() }
        sync.show = { [weak self] fields in self?.adopt(fields) }
        if let loaded { show(loaded) } else if let cached = Self.cache[itemID] { show(cached) }
    }

    var hooks: [String] { item?.hooks ?? [] }

    func load() async {
        if item == nil { phase = .loading }
        do {
            let envelope: IdeaCanvasItemEnvelope = try await StudioJSONClient.get("api/content/\(itemID)")
            // Local edits not yet saved win over what the server had.
            if item == nil || !autosave.hasUnsaved { show(envelope.item) }
        } catch let error as StudioAPIError where error.status == 404 && error.code == "not_found" {
            Self.cache[itemID] = nil
            item = nil
            phase = .missing
        } catch {
            if item == nil { phase = .failed }
        }
    }

    /// The server saved these fields itself (a canvas ask).
    func markSaved(_ fields: IdeaCanvasPatch) { sync.markSaved(fields) }

    func update(_ patch: IdeaCanvasPatch) {
        guard let current = item else { return }
        let next = current.applying(patch)
        item = next
        Self.cache[itemID] = next
        autosave.queue(patch)
    }

    func setBlocks(_ next: [IdeaCanvasBlock]) {
        blocks = next
        update(IdeaCanvasDoc.patch(from: next))
    }

    func setHooks(_ hooks: [String]) {
        update(IdeaCanvasPatch(hooks: hooks))
    }

    func delete() async throws {
        try? await autosave.flush()
        try await StudioJSONClient.delete("api/content/\(itemID)")
        Self.cache[itemID] = nil
        NotificationCenter.default.post(name: .ideaCanvasDidDelete, object: itemID)
    }

    private func show(_ loaded: IdeaCanvasItem) {
        item = loaded
        blocks = IdeaCanvasDoc.keepingIDs(IdeaCanvasDoc.blocks(from: loaded.blocks, script: loaded.script), from: blocks)
        phase = .loaded
        Self.cache[itemID] = loaded
        sync.read(Self.fields(loaded))
    }

    /// A merged save kept someone else's change: show it without saving it
    /// again, keeping the ids of blocks that did not change.
    private func adopt(_ fields: IdeaCanvasPatch) {
        guard let current = item else { return }
        let next = current.applying(fields)
        item = next
        Self.cache[itemID] = next
        if fields.blocks != nil || fields.script != nil {
            blocks = IdeaCanvasDoc.keepingIDs(IdeaCanvasDoc.blocks(from: next.blocks, script: next.script), from: blocks)
        }
    }

    private static func fields(_ item: IdeaCanvasItem) -> IdeaCanvasPatch {
        IdeaCanvasPatch(title: item.title, hooks: item.hooks, blocks: item.blocks, script: IdeaCanvasNullable(item.script))
    }
}
