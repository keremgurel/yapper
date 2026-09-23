import Foundation

/// The creator's ideas and library items, for choosing what to record.
@MainActor
final class RecorderIdeaListStore: ObservableObject {
    static let shared = RecorderIdeaListStore()

    @Published private(set) var items: [RecorderContentSummary]?
    @Published private(set) var error: String?

    var loading: Bool { items == nil && error == nil }

    func refresh() async {
        do {
            let response: RecorderContentListResponse = try await StudioJSONClient.get("api/content")
            items = response.items
            error = nil
        } catch {
            if items == nil { self.error = error.localizedDescription }
        }
    }

    func filtered(_ query: String) -> [RecorderContentSummary] {
        let needle = query.trimmingCharacters(in: .whitespaces).lowercased()
        let all = items ?? []
        guard !needle.isEmpty else { return all }
        return all.filter { $0.title.lowercased().contains(needle) }
    }
}
