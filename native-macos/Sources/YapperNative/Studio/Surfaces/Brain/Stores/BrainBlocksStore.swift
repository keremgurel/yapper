import Foundation

/// Knowledge: the creator's own sections. Edits land locally first and are
/// autosaved per block; adds, removes and reorders go straight to the server.
@MainActor
final class BrainBlocksStore: ObservableObject {
    static let shared = BrainBlocksStore()

    @Published private(set) var blocks: [BrainBlock]?
    @Published private(set) var error: String?
    @Published private(set) var saveState: BrainSaveState = .idle
    @Published private(set) var removing: Set<String> = []

    var loading: Bool { blocks == nil && error == nil }
    var available: Bool { blocks != nil }

    /// Bumped by every local change, so a list read that started before one
    /// does not overwrite it.
    private var revision = 0
    private let saver = BrainAutosaver()

    init() {
        saver.write = { id, patch in
            let _: BrainBlockResponse = try await StudioJSONClient.patch("api/brain/blocks/\(id)", body: patch)
            BrainPreviewStore.shared.invalidate()
        }
        saver.onState = { [weak self] in self?.saveState = $0 }
    }

    func refresh() async {
        try? await saver.flush()
        let started = revision
        do {
            let response: BrainBlocksResponse = try await StudioJSONClient.get("api/brain/blocks")
            if started == revision, !saver.hasPending { blocks = response.blocks }
            error = nil
        } catch {
            self.error = "Your Knowledge couldn't be loaded. Try again."
        }
    }

    /// Sends anything still waiting, for when the page goes away.
    func flush() async { try? await saver.flush() }

    func retry() async {
        if saveState == .error { try? await saver.flush() } else { await refresh() }
    }

    func edit(_ id: String, _ edit: BrainBlockEdit) {
        guard !removing.contains(id), let index = blocks?.firstIndex(where: { $0.id == id }) else { return }
        revision += 1
        edit.apply(to: &blocks![index])
        saver.queue(id, edit.patch)
    }

    @discardableResult
    func add(_ block: NewBrainBlock) async throws -> BrainBlock {
        guard blocks != nil else { throw StudioAPIError(status: 0, code: "knowledge_not_loaded", message: "Your Knowledge hasn't loaded yet.") }
        do {
            let response: BrainBlockResponse = try await StudioJSONClient.post("api/brain/blocks", body: block.payload)
            revision += 1
            blocks?.append(response.block)
            error = nil
            BrainPreviewStore.shared.invalidate()
            return response.block
        } catch {
            self.error = "That Knowledge couldn't be added. Try again."
            throw error
        }
    }

    /// Picks up a block another action created, such as a catalog install.
    func insert(_ block: BrainBlock) {
        revision += 1
        blocks?.append(block)
    }

    func remove(_ id: String) async {
        guard !removing.contains(id) else { return }
        removing.insert(id)
        defer { removing.remove(id) }
        saver.discard(id)
        do {
            try? await saver.flush()
            try await StudioJSONClient.delete("api/brain/blocks/\(id)")
            revision += 1
            blocks?.removeAll { $0.id == id }
            error = nil
            BrainPreviewStore.shared.invalidate()
        } catch {
            self.error = "That memory couldn't be removed. Your Knowledge is still here."
        }
    }

    func move(_ id: String, by offset: Int) async {
        guard var order = blocks?.map(\.id), let from = order.firstIndex(of: id) else { return }
        let to = from + offset
        guard order.indices.contains(to) else { return }
        order.swapAt(from, to)
        await reorder(order)
    }

    func reorder(_ ids: [String]) async {
        // Show the new order at once; the server's answer confirms it.
        let byID = Dictionary(uniqueKeysWithValues: (blocks ?? []).map { ($0.id, $0) })
        let previous = blocks
        revision += 1
        blocks = ids.compactMap { byID[$0] } + (blocks ?? []).filter { !ids.contains($0.id) }
        do {
            try? await saver.flush()
            let response: BrainBlocksResponse = try await StudioJSONClient.patch("api/brain/blocks", body: ["order": ids])
            let current = Dictionary(uniqueKeysWithValues: (blocks ?? []).map { ($0.id, $0) })
            let known = Set(response.blocks.map(\.id))
            blocks = response.blocks.map { saved in
                var block = current[saved.id] ?? saved
                block.sortOrder = saved.sortOrder
                return block
            } + (blocks ?? []).filter { !known.contains($0.id) }
            error = nil
            BrainPreviewStore.shared.invalidate()
        } catch {
            blocks = previous
            self.error = "The new order couldn't be saved. Move the memory again to retry."
        }
    }
}
