import Foundation

/// One entry's writes: one at a time, with the failed change kept for a retry.
@MainActor
final class DictionaryRowEditor: ObservableObject {
    enum Failure: Equatable {
        case save(term: String, aliases: [String])
        case delete
    }

    @Published private(set) var saving = false
    @Published private(set) var failure: Failure?

    private let id: String
    private let store: DictionaryPageStore

    init(id: String, store: DictionaryPageStore) {
        self.id = id
        self.store = store
    }

    var message: String? {
        switch failure {
        case .delete: "This spelling couldn't be removed. Try again."
        case .save: "That change couldn't be saved. Your current spelling is kept; check that the new spelling is valid and unique."
        case nil: nil
        }
    }

    /// Returns the saved entry, or nil when the save failed or another write
    /// was still running.
    @discardableResult
    func save(term: String, aliases: [String]) async -> DictionaryEntry? {
        guard !saving else { return nil }
        saving = true
        failure = nil
        defer { saving = false }
        do {
            return try await store.update(id: id, term: term, aliases: aliases)
        } catch {
            failure = .save(term: term, aliases: aliases)
            return nil
        }
    }

    func remove() async {
        guard !saving else { return }
        saving = true
        failure = nil
        defer { saving = false }
        do {
            try await store.remove(id: id)
        } catch {
            failure = .delete
        }
    }

    func retry() async -> DictionaryEntry? {
        switch failure {
        case let .save(term, aliases): return await save(term: term, aliases: aliases)
        case .delete: await remove(); return nil
        case nil: return nil
        }
    }
}
