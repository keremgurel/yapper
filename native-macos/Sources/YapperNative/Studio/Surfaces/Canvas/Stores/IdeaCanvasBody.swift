import Foundation

/// What one tab of the canvas edits: a version's openers (hooks, titles or
/// headlines, the first in use) and its blocks. The lead lives on the item
/// and every other version in its own store; the document views and Chirpy
/// only see this.
@MainActor
protocol IdeaCanvasBody: AnyObject {
    var format: IdeaCanvasVersionFormat { get }
    var blocks: [IdeaCanvasBlock] { get }
    var hooks: [String] { get }
    /// Flushed before an ask: the server edits the version it has saved.
    var autosave: IdeaCanvasAutosave { get }
    func setBlocks(_ next: [IdeaCanvasBlock])
    func setHooks(_ hooks: [String])
}

extension IdeaCanvasBody {
    func editBlocks(_ change: ([IdeaCanvasBlock]) -> [IdeaCanvasBlock]) {
        setBlocks(change(blocks))
    }
}

extension IdeaCanvasItemStore: IdeaCanvasBody {
    var format: IdeaCanvasVersionFormat { item?.leadFormat ?? .short }
}
