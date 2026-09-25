import Foundation

/// A field that can be set to a value or cleared to JSON null.
enum IdeaCanvasNullable<Value: Encodable & Equatable>: Equatable {
    case value(Value)
    case null

    var value: Value? {
        if case .value(let value) = self { return value }
        return nil
    }

    init(_ optional: Value?) {
        self = optional.map { .value($0) } ?? .null
    }
}

/// The fields the canvas writes with `PATCH api/content/[id]`. Absent keys
/// are left alone by the route, so only what changed is sent.
struct IdeaCanvasPatch: Encodable, Equatable {
    var title: String?
    var status: IdeaCanvasStatus?
    var formats: [String]?
    var pillarId: IdeaCanvasNullable<String>?
    var scheduledFor: String?
    var hooks: [String]?
    var blocks: [IdeaCanvasStoredBlock]?
    var script: IdeaCanvasNullable<String>?
    var originalNote: String?
    var ideaType: String?

    var isEmpty: Bool { self == IdeaCanvasPatch() }

    /// This patch with a newer one laid over it, key by key.
    func merged(with newer: IdeaCanvasPatch) -> IdeaCanvasPatch {
        IdeaCanvasPatch(
            title: newer.title ?? title,
            status: newer.status ?? status,
            formats: newer.formats ?? formats,
            pillarId: newer.pillarId ?? pillarId,
            scheduledFor: newer.scheduledFor ?? scheduledFor,
            hooks: newer.hooks ?? hooks,
            blocks: newer.blocks ?? blocks,
            script: newer.script ?? script,
            originalNote: newer.originalNote ?? originalNote,
            ideaType: newer.ideaType ?? ideaType
        )
    }

    private enum CodingKeys: String, CodingKey {
        case title, status, formats, pillarId, scheduledFor, hooks, blocks, script, originalNote, ideaType
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encodeIfPresent(title, forKey: .title)
        try c.encodeIfPresent(status?.rawValue, forKey: .status)
        try c.encodeIfPresent(formats, forKey: .formats)
        try encode(pillarId, key: .pillarId, into: &c)
        try c.encodeIfPresent(scheduledFor, forKey: .scheduledFor)
        try c.encodeIfPresent(hooks, forKey: .hooks)
        try c.encodeIfPresent(blocks, forKey: .blocks)
        try encode(script, key: .script, into: &c)
        try c.encodeIfPresent(originalNote, forKey: .originalNote)
        try c.encodeIfPresent(ideaType, forKey: .ideaType)
    }

    private func encode(
        _ field: IdeaCanvasNullable<String>?, key: CodingKeys, into c: inout KeyedEncodingContainer<CodingKeys>
    ) throws {
        switch field {
        case .none: break
        case .some(.null): try c.encodeNil(forKey: key)
        case .some(.value(let value)): try c.encode(value, forKey: key)
        }
    }
}
