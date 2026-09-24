import Foundation

extension Notification.Name {
    /// Posted with the item id as `object` after the canvas saves or deletes
    /// an idea, so a list showing it can refresh.
    static let ideaCanvasDidSave = Notification.Name("IdeaCanvasDidSave")
    static let ideaCanvasDidDelete = Notification.Name("IdeaCanvasDidDelete")
}

/// One idea on the canvas: the loaded row, its blocks with client ids, and
/// the single writer every edit goes through (`update`), which feeds the
/// autosave. Chirpy's changes go through the same writer.
@MainActor
final class IdeaCanvasItemStore: ObservableObject {
    enum Phase: Equatable { case loading, loaded, missing, failed }

    /// Items seen this session, so reopening one paints at once.
    private static var cache: [String: IdeaCanvasItem] = [:]

    let itemID: String
    let autosave: IdeaCanvasAutosave
    @Published private(set) var item: IdeaCanvasItem?
    @Published private(set) var blocks: [IdeaCanvasBlock] = []
    @Published private(set) var phase: Phase = .loading

    init(itemID: String) {
        self.itemID = itemID
        let path = "api/content/\(itemID)"
        autosave = IdeaCanvasAutosave { patch in
            try await StudioJSONClient.raw(path, method: "PATCH", body: StudioJSONClient.encoder.encode(patch))
            NotificationCenter.default.post(name: .ideaCanvasDidSave, object: itemID)
        }
        if let cached = Self.cache[itemID] { show(cached) }
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
        blocks = IdeaCanvasDoc.blocks(from: loaded.blocks, script: loaded.script)
        phase = .loaded
        Self.cache[itemID] = loaded
    }
}
