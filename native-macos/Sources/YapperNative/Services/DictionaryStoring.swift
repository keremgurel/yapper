import Foundation

/// The dictionary operations the editor and its actions use, so tests can run
/// them against memory instead of the account and the creator's own file.
protocol DictionaryStoring: Sendable {
    func entries() async -> [DictionaryEntry]
    func save(term: String, aliases: [String]) async throws -> [DictionaryEntry]
    func update(id: String, term: String, aliases: [String]) async -> [DictionaryEntry]
    func remove(id: String) async -> [DictionaryEntry]
}

extension DictionaryStore: DictionaryStoring {}
