import Foundation

/// The creator's saved views above the list, and the one being looked at.
///
/// Views live under the library scope, where the web keeps them, so the
/// views a creator already made show up here too. Which tab is open is local:
/// two windows should not fight over it.
@MainActor
final class IdeaViewsStore: ObservableObject {
    static let shared = IdeaViewsStore()
    private static let path = "api/views?stage=library"

    @Published private(set) var views: [LibraryView]?
    @Published private(set) var failed = false
    @Published private(set) var creating = false
    @Published private(set) var createFailed = false
    @Published var activeID: String?

    var active: LibraryView? {
        guard let views else { return nil }
        return views.first { $0.id == activeID } ?? views.first
    }

    func reload() async {
        do {
            let response: LibraryViewsResponse = try await StudioJSONClient.get(Self.path)
            views = response.views
            failed = false
        } catch {
            failed = true
        }
    }

    func create() {
        guard !creating else { return }
        creating = true
        createFailed = false
        Task {
            defer { creating = false }
            do {
                let response: LibraryViewResponse = try await StudioJSONClient.post(Self.path, body: ViewDraft.fresh)
                views = (views ?? []) + [response.view]
                activeID = response.view.id
            } catch {
                createFailed = true
            }
        }
    }

    func save(_ id: String, _ draft: ViewDraft) async throws {
        let response: LibraryViewResponse = try await StudioJSONClient.patch("api/views/\(id)", body: draft)
        views = views?.map { $0.id == id ? response.view : $0 }
    }

    func remove(_ id: String) async throws {
        try await StudioJSONClient.delete("api/views/\(id)")
        let next = (views ?? []).filter { $0.id != id }
        views = next
        if activeID == id { activeID = next.first?.id }
        // The server seeds the defaults again once the last one is gone.
        if next.isEmpty { await reload() }
    }
}
