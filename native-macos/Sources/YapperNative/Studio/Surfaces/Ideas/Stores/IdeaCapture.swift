import Foundation

/// Banking a thought. The creator's exact words are stored first and the
/// call returns; resolving the link and the AI's first pass run afterwards
/// and patch the same row, so a slow or failed provider never costs the
/// creator their thought.
@MainActor
final class IdeaCapture: ObservableObject {
    static let shared = IdeaCapture()

    /// Rows whose first pass is running.
    @Published private(set) var working: Set<String> = []
    /// Rows whose first pass failed; the words are kept and it can be rerun.
    @Published private(set) var analysisFailed: Set<String> = []

    private let store = IdeasStore.shared

    /// Throws only when the words themselves could not be stored.
    func capture(_ text: String) async throws {
        let parsed = CaptureText.parse(text)
        guard parsed.note != nil || parsed.url != nil else { return }
        let note = parsed.note ?? ""
        let request = CreateIdeaRequest(
            originalNote: note,
            sourceUrl: parsed.url,
            ideaType: CaptureText.kind(note: parsed.note, url: parsed.url).rawValue,
            transcriptStatus: parsed.url == nil ? nil : "pending"
        )
        let created: IdeaItemResponse = try await StudioJSONClient.post("api/ideas", body: request)
        store.prepend(created.item)
        Task { await enrich(created.item.id, url: parsed.url, note: note) }
    }

    func retry(_ id: String) {
        guard let row = store.item(id) else { return }
        Task { await enrich(id, url: row.sourceUrl, note: row.originalNote) }
    }

    private func enrich(_ id: String, url: String?, note: String) async {
        guard !working.contains(id) else { return }
        working.insert(id)
        analysisFailed.remove(id)
        defer { working.remove(id) }
        do {
            var source: IdeaSource?
            if let url {
                let resolved: ResolvedLink = try await StudioJSONClient.post("api/inspiration/resolve", body: ["url": url])
                let resolvedSource = IdeaSource(url: url, resolved: resolved)
                source = resolvedSource
                let patch = SourcePatch(resolvedSource)
                let saved: IdeaItemResponse = try await StudioJSONClient.patch("api/content/\(id)", body: patch)
                store.update(id) {
                    $0.updatedAt = saved.item.updatedAt
                    $0.sourceTitle = patch.sourceTitle
                    $0.sourcePlatform = patch.sourcePlatform
                    $0.transcriptStatus = patch.transcriptStatus
                }
            }

            let request = ExpandRequest(input: .init(transcript: note.isEmpty ? nil : note, url: url, source: source))
            let reply: ExpandResponse = try await StudioJSONClient.post("api/ideas/expand", body: request)
            guard let expansion = reply.expansion else { throw StudioAPIError(status: 200, code: "expand_empty", message: "") }
            let patch = ExpansionPatch(expansion)
            let saved: IdeaItemResponse = try await StudioJSONClient.patch("api/content/\(id)", body: patch)
            store.update(id) {
                $0.updatedAt = saved.item.updatedAt
                $0.title = patch.title ?? ""
                $0.script = patch.script
                $0.pillar = patch.pillar
                $0.pillarId = saved.item.pillarId
            }
        } catch {
            analysisFailed.insert(id)
        }
    }
}
