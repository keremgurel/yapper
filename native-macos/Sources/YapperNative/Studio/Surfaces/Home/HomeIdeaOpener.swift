import Foundation

/// Opens one of today's prompts on its canvas. A saved idea opens as it is;
/// a starter prompt is captured first (`POST /api/ideas`) so the canvas has
/// a real item to open.
@MainActor
final class HomeIdeaOpener: ObservableObject {
    @Published private(set) var openingTitle: String?
    @Published private(set) var error: String?

    private struct Capture: Encodable { let originalNote: String }

    func open(_ idea: HomeDailyIdea) async {
        if let id = idea.itemID {
            StudioNavigation.shared.openIdea(id)
            return
        }
        guard openingTitle == nil else { return }
        openingTitle = idea.title
        error = nil
        defer { openingTitle = nil }
        do {
            let created: HomeCreatedIdea = try await StudioJSONClient.post("api/ideas", body: Capture(originalNote: idea.title))
            StudioNavigation.shared.openIdea(created.item.id)
        } catch {
            self.error = "That idea couldn't be saved. \(error.localizedDescription)"
        }
    }
}
