import Foundation

/// One non-lead version on the canvas: its blocks with client ids and one
/// debounced autosave to `PUT api/content/[id]/versions/[format]`. Mirrors
/// the item store, so a tab edits the same way whichever version it shows.
@MainActor
final class IdeaCanvasVersionStore: ObservableObject, IdeaCanvasBody {
    let format: IdeaCanvasVersionFormat
    let autosave: IdeaCanvasAutosave
    @Published private(set) var version: IdeaCanvasVersion
    @Published private(set) var blocks: [IdeaCanvasBlock]

    init(itemID: String, version: IdeaCanvasVersion) {
        format = version.format
        self.version = version
        blocks = IdeaCanvasDoc.blocks(from: version.blocks, script: version.script)
        let path = "api/content/\(itemID)/versions/\(version.format.rawValue)"
        autosave = IdeaCanvasAutosave { patch in
            try await StudioJSONClient.raw(path, method: "PUT", body: StudioJSONClient.encoder.encode(patch))
            NotificationCenter.default.post(name: .ideaCanvasDidSave, object: itemID)
        }
    }

    var hooks: [String] { version.hooks }

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
}
