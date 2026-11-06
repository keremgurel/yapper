import Foundation

/// Sends one canvas body's autosaves with the stored copy they started from,
/// and settles what the server answers (see `IdeaCanvasRebase`). The item
/// store and each version store own one; it knows nothing of the UI beyond
/// the two closures they set.
@MainActor
final class IdeaCanvasSync {
    typealias Transport = @MainActor (_ path: String, _ method: String, _ body: Data) async throws -> Data

    private let path: String
    private let method: String
    private let itemID: String
    private let transport: Transport
    /// The stored copy of each canvas field, as last read or saved.
    private(set) var base = IdeaCanvasPatch()
    /// The canvas fields as shown now.
    var latest: @MainActor () -> IdeaCanvasPatch = { IdeaCanvasPatch() }
    /// Shows fields a merged save changed.
    var show: @MainActor (IdeaCanvasPatch) -> Void = { _ in }

    init(path: String, method: String, itemID: String, transport: @escaping Transport = IdeaCanvasSync.send) {
        self.path = path
        self.method = method
        self.itemID = itemID
        self.transport = transport
    }

    /// The body was loaded from the server: that copy is the base now.
    func read(_ fields: IdeaCanvasPatch) { base = IdeaCanvasRebase.canvasFields(of: fields) }

    /// The server saved these fields itself (a canvas ask).
    func markSaved(_ fields: IdeaCanvasPatch) { base = base.merged(with: IdeaCanvasRebase.canvasFields(of: fields)) }

    func save(_ patch: IdeaCanvasPatch) async throws {
        let body = IdeaCanvasSaveBody(patch: patch, base: IdeaCanvasRebase.base(base, for: patch))
        let data = try await transport(path, method, StudioJSONClient.encoder.encode(body))
        let reply = try JSONDecoder().decode(IdeaCanvasSaveReply.self, from: data)
        let settled = IdeaCanvasRebase.afterSave(
            base: base, sent: IdeaCanvasRebase.canvasFields(of: patch), saved: reply.fields,
            latest: latest(), rebased: reply.rebased
        )
        base = settled.base
        if !settled.show.isEmpty { show(settled.show) }
        NotificationCenter.default.post(name: .ideaCanvasDidSave, object: itemID)
    }

    private static func send(_ path: String, _ method: String, _ body: Data) async throws -> Data {
        try await StudioJSONClient.raw(path, method: method, body: body)
    }
}
