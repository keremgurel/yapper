import Foundation

/// The creator's pillars, read only, for the bulk reclassify menu. Editing
/// them lives in Brain. A failed read leaves the menu empty, not broken.
@MainActor
final class IdeaPillarsStore: ObservableObject {
    static let shared = IdeaPillarsStore()

    @Published private(set) var pillars: [ProjectPillarsResponse.Pillar] = []

    func refresh() async {
        if let response: ProjectPillarsResponse = try? await StudioJSONClient.get("api/project") {
            pillars = response.pillars
        }
    }
}
