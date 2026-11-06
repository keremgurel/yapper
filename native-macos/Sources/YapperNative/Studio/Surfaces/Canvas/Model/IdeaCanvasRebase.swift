import Foundation

/// The client half of a merged save, as `lib/content/save-base.ts`: each
/// autosave sends the stored copy its fields started from as `base`, so the
/// server merges it into a change made since (Chirpy from another tab, a
/// second window) instead of replacing it. Only the canvas fields take part:
/// title, hooks, blocks and script.
enum IdeaCanvasRebase {
    /// The canvas fields of a patch, the rest left out.
    static func canvasFields(of patch: IdeaCanvasPatch) -> IdeaCanvasPatch {
        IdeaCanvasPatch(title: patch.title, hooks: patch.hooks, blocks: patch.blocks, script: patch.script)
    }

    /// The base for the fields `patch` sends.
    static func base(_ base: IdeaCanvasPatch, for patch: IdeaCanvasPatch) -> IdeaCanvasPatch {
        IdeaCanvasPatch(
            title: patch.title == nil ? nil : base.title,
            hooks: patch.hooks == nil ? nil : base.hooks,
            blocks: patch.blocks == nil ? nil : base.blocks,
            script: patch.script == nil ? nil : base.script
        )
    }

    /// After a save: the base for the next one, and the saved fields to show
    /// in place of the client's. A merged save is shown only for fields the
    /// creator has not touched since it was sent; their newer typing goes
    /// next with the sent copy as its base, so the server merges it again.
    static func afterSave(
        base: IdeaCanvasPatch, sent: IdeaCanvasPatch, saved: IdeaCanvasPatch,
        latest: IdeaCanvasPatch, rebased: Bool
    ) -> (base: IdeaCanvasPatch, show: IdeaCanvasPatch) {
        var next = base
        var show = IdeaCanvasPatch()
        func settle<Value: Equatable>(_ key: WritableKeyPath<IdeaCanvasPatch, Value?>) {
            guard let sentValue = sent[keyPath: key] else { return }
            let savedValue = saved[keyPath: key]
            let untouched = latest[keyPath: key] == sentValue
            next[keyPath: key] = !rebased || untouched ? savedValue : sentValue
            if rebased, untouched, savedValue != sentValue { show[keyPath: key] = savedValue }
        }
        settle(\.title)
        settle(\.hooks)
        settle(\.blocks)
        settle(\.script)
        return (next, show)
    }
}

/// What the item's PATCH and a version's PUT send: the patch with its base.
struct IdeaCanvasSaveBody: Encodable {
    let patch: IdeaCanvasPatch
    let base: IdeaCanvasPatch

    private enum CodingKeys: String, CodingKey { case base }

    func encode(to encoder: Encoder) throws {
        try patch.encode(to: encoder)
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(base, forKey: .base)
    }
}

/// `{ item | version, rebased }` from a save, reduced to the canvas fields.
struct IdeaCanvasSaveReply: Decodable, Equatable {
    let fields: IdeaCanvasPatch
    let rebased: Bool

    private enum CodingKeys: String, CodingKey { case item, version, rebased }
    private enum FieldKeys: String, CodingKey { case title, hooks, blocks, script }

    init(fields: IdeaCanvasPatch, rebased: Bool) {
        self.fields = fields
        self.rebased = rebased
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let row = try c.contains(.item)
            ? c.nestedContainer(keyedBy: FieldKeys.self, forKey: .item)
            : c.nestedContainer(keyedBy: FieldKeys.self, forKey: .version)
        // A field the reply leaves out stays absent; a null script is null.
        fields = IdeaCanvasPatch(
            title: try row.decodeIfPresent(String.self, forKey: .title),
            hooks: try row.decodeIfPresent([IdeaCanvasHook].self, forKey: .hooks)?
                .map { $0.text.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty },
            blocks: try row.decodeIfPresent([IdeaCanvasStoredBlock].self, forKey: .blocks),
            script: row.contains(.script) ? IdeaCanvasNullable(try row.decodeIfPresent(String.self, forKey: .script)) : nil
        )
        rebased = try c.decodeIfPresent(Bool.self, forKey: .rebased) ?? false
    }
}
