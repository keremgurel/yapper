import Foundation

/// The header's Blank action: an empty idea, opened on its canvas at once,
/// for writing without a capture.
@MainActor
final class BlankIdeaCreator: ObservableObject {
    static let shared = BlankIdeaCreator()

    @Published private(set) var creating = false
    @Published private(set) var failed = false

    func create() {
        guard !creating else { return }
        creating = true
        failed = false
        Task {
            defer { creating = false }
            do {
                let created: IdeaItemResponse = try await StudioJSONClient.post("api/content", body: CreateBlankRequest())
                IdeasStore.shared.prepend(created.item)
                StudioNavigation.shared.openIdeaID = created.item.id
            } catch {
                failed = true
            }
        }
    }
}
