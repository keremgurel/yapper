import Foundation

/// One non-lead version on the canvas: its blocks with client ids and one
/// debounced autosave to `PUT api/content/[id]/versions/[format]`. Mirrors
/// the item store, so a tab edits the same way whichever version it shows.
@MainActor
final class IdeaCanvasVersionStore: ObservableObject, IdeaCanvasBody {
    let format: IdeaCanvasVersionFormat
    let sync: IdeaCanvasSync
    let autosave: IdeaCanvasAutosave
    @Published private(set) var version: IdeaCanvasVersion
    @Published private(set) var blocks: [IdeaCanvasBlock]

    init(itemID: String, version: IdeaCanvasVersion, transport: IdeaCanvasSync.Transport? = nil) {
        format = version.format
        self.version = version
        blocks = IdeaCanvasDoc.blocks(from: version.blocks, script: version.script)
        let path = "api/content/\(itemID)/versions/\(version.format.rawValue)"
        let sync = transport.map { IdeaCanvasSync(path: path, method: "PUT", itemID: itemID, transport: $0) }
            ?? IdeaCanvasSync(path: path, method: "PUT", itemID: itemID)
        self.sync = sync
        autosave = IdeaCanvasAutosave { patch in try await sync.save(patch) }
        sync.read(Self.fields(version))
        sync.latest = { [weak self] in self.map { Self.fields($0.version) } ?? IdeaCanvasPatch() }
        sync.show = { [weak self] fields in self?.adopt(fields) }
    }

    var hooks: [String] { version.hooks }

    /// Shows what the server saved, unless edits here are still unsaved.
    func reload(_ saved: IdeaCanvasVersion) {
        guard !autosave.hasUnsaved, saved != version else { return }
        version = saved
        blocks = IdeaCanvasDoc.keepingIDs(IdeaCanvasDoc.blocks(from: saved.blocks, script: saved.script), from: blocks)
        sync.read(Self.fields(saved))
    }

    /// The server saved these fields itself (a canvas ask). The version's
    /// title follows its first opener, so the idea's title is not its base.
    func markSaved(_ fields: IdeaCanvasPatch) {
        var fields = fields
        fields.title = nil
        sync.markSaved(fields)
    }

    func setBlocks(_ next: [IdeaCanvasBlock]) {
        blocks = next
        update(IdeaCanvasDoc.patch(from: next))
    }

    /// The first option is the title in use, so it is saved as the title too.
    func setHooks(_ hooks: [String]) {
        update(IdeaCanvasPatch(title: hooks.first, hooks: hooks))
    }

    private func update(_ patch: IdeaCanvasPatch) {
        version = version.applying(patch)
        autosave.queue(patch)
    }

    /// A merged save kept someone else's change: show it without saving it
    /// again.
    private func adopt(_ fields: IdeaCanvasPatch) {
        version = version.applying(fields)
        if fields.blocks != nil || fields.script != nil {
            blocks = IdeaCanvasDoc.keepingIDs(IdeaCanvasDoc.blocks(from: version.blocks, script: version.script), from: blocks)
        }
    }

    private static func fields(_ version: IdeaCanvasVersion) -> IdeaCanvasPatch {
        IdeaCanvasPatch(title: version.title, hooks: version.hooks, blocks: version.blocks, script: IdeaCanvasNullable(version.script))
    }
}
