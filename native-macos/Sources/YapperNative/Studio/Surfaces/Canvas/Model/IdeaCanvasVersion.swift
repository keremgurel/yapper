import Foundation

/// A version of an idea other than its lead, from `versions` on
/// `GET api/content/[id]`. Same body fields as the item itself.
struct IdeaCanvasVersion: Decodable, Equatable {
    let format: IdeaCanvasVersionFormat
    var title: String?
    var hooks: [String]
    var blocks: [IdeaCanvasStoredBlock]
    var script: String?
    var writtenFrom: IdeaCanvasVersionFormat?

    private enum CodingKeys: String, CodingKey { case format, title, hooks, blocks, script, writtenFrom }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        format = try c.decode(IdeaCanvasVersionFormat.self, forKey: .format)
        title = try c.decodeIfPresent(String.self, forKey: .title)
        hooks = (try c.decodeIfPresent([IdeaCanvasHook].self, forKey: .hooks) ?? [])
            .map { $0.text.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        blocks = try c.decodeIfPresent([IdeaCanvasStoredBlock].self, forKey: .blocks) ?? []
        script = try c.decodeIfPresent(String.self, forKey: .script)
        writtenFrom = try? c.decodeIfPresent(IdeaCanvasVersionFormat.self, forKey: .writtenFrom)
    }

    func applying(_ patch: IdeaCanvasPatch) -> IdeaCanvasVersion {
        var next = self
        if let title = patch.title { next.title = title }
        if let hooks = patch.hooks { next.hooks = hooks }
        if let blocks = patch.blocks { next.blocks = blocks }
        if let script = patch.script { next.script = script.value }
        return next
    }
}

/// `{ version }`, what the versions routes answer with.
struct IdeaCanvasVersionEnvelope: Decodable {
    let version: IdeaCanvasVersion
}
