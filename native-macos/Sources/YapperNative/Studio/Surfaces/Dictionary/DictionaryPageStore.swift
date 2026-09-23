import Foundation

/// The account's saved spellings for the Studio Dictionary page.
///
/// Every call goes to the same routes the web page uses and reports failure
/// instead of quietly falling back to this machine, because a creator
/// managing the list needs to know a change did not reach the account. Each
/// good read or write is copied into `DictionaryStore` so the editor stays in
/// step.
@MainActor
final class DictionaryPageStore: ObservableObject {
    static let shared = DictionaryPageStore()

    private static let path = "api/transcription-dictionary"

    @Published private(set) var entries: [DictionaryEntry] = []
    @Published private(set) var loaded = false
    @Published private(set) var loadError: String?

    var loading: Bool { !loaded && loadError == nil }

    func refresh() async {
        do {
            let response: DictionaryListResponse = try await StudioJSONClient.get(Self.path)
            entries = response.entries
            loaded = true
            loadError = nil
            await DictionaryStore.shared.cache(entries)
        } catch {
            // Keep what is already on screen; only an empty page shows the error.
            loadError = DictionaryCopy.message(for: error)
        }
    }

    /// Adds a spelling, or merges the mishearing into one already saved.
    func add(term: String, alias: String) async throws {
        let aliases = alias.trimmingCharacters(in: .whitespaces).isEmpty ? [] : [alias]
        let response: DictionaryEntryResponse = try await StudioJSONClient.post(
            Self.path, body: DictionaryEntryInput(term: term, aliases: aliases)
        )
        entries.removeAll { $0.id == response.entry.id }
        entries.insert(response.entry, at: 0)
        await DictionaryStore.shared.cache(entries)
    }

    /// Saves a new spelling or mishearing list for one entry.
    @discardableResult
    func update(id: String, term: String, aliases: [String]) async throws -> DictionaryEntry {
        let response: DictionaryEntryResponse = try await StudioJSONClient.patch(
            "\(Self.path)/\(id)", body: DictionaryEntryInput(term: term, aliases: aliases)
        )
        if let index = entries.firstIndex(where: { $0.id == id }) {
            entries[index] = response.entry
        }
        await DictionaryStore.shared.cache(entries)
        return response.entry
    }

    func remove(id: String) async throws {
        try await StudioJSONClient.delete("\(Self.path)/\(id)")
        entries.removeAll { $0.id == id }
        await DictionaryStore.shared.cache(entries)
    }
}
