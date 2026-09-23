import Foundation

struct IdeaCanvasPillar: Decodable, Equatable, Identifiable {
    let id: String
    let name: String
}

/// `{ project, pillars }` from `GET api/project`; the canvas reads only the pillars.
struct IdeaCanvasProjectResponse: Decodable {
    let pillars: [IdeaCanvasPillar]
}

/// The creator's pillars, read once and shared by every open canvas. They
/// change about once a month, so a cached list is shown straight away.
@MainActor
final class IdeaCanvasPillarStore: ObservableObject {
    static let shared = IdeaCanvasPillarStore()

    @Published private(set) var pillars: [IdeaCanvasPillar] = []
    private var loaded = false

    func loadIfNeeded() async {
        guard !loaded else { return }
        do {
            let response: IdeaCanvasProjectResponse = try await StudioJSONClient.get("api/project")
            pillars = response.pillars
            loaded = true
        } catch {
            // The field degrades to "No pillar" rather than blocking the page.
        }
    }
}
