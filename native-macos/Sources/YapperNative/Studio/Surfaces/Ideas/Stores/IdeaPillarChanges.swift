import Foundation

/// One row's pillar change: shown at once, saved behind, put back if the
/// save fails. Same shape as status changes.
@MainActor
final class IdeaPillarChanges: ObservableObject {
    static let shared = IdeaPillarChanges()

    @Published private(set) var failed: Set<String> = []
    private let store = IdeasStore.shared
    private var generation: [String: Int] = [:]

    func change(_ id: String, to pillar: ProjectPillarsResponse.Pillar?) {
        guard let row = store.item(id) else { return }
        let previous = (row.pillar, row.pillarId)
        let ticket = (generation[id] ?? 0) + 1
        generation[id] = ticket
        store.update(id) {
            $0.pillar = pillar?.name
            $0.pillarId = pillar?.id
        }
        Task {
            do {
                let saved: IdeaItemResponse = try await StudioJSONClient.patch(
                    "api/content/\(id)", body: PillarPatch(pillarId: pillar?.id)
                )
                guard generation[id] == ticket else { return }
                store.update(id) { $0.updatedAt = saved.item.updatedAt }
                failed.remove(id)
            } catch {
                guard generation[id] == ticket else { return }
                store.update(id) {
                    $0.pillar = previous.0
                    $0.pillarId = previous.1
                }
                failed.insert(id)
            }
        }
    }
}

/// `pillarId` is always sent, so choosing "No pillar" clears it.
private struct PillarPatch: Encodable {
    let pillarId: String?
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(pillarId, forKey: .pillarId)
    }
    private enum CodingKeys: String, CodingKey { case pillarId }
}
