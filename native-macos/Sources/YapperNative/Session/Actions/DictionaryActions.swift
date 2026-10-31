import Foundation

/// The transcription dictionary as actions: the dictionary panel and Chirpy
/// both add, edit and remove spellings through these. The dictionary belongs to
/// the account, so receipts name the open project only as where the change was
/// made.
extension AppActionRegistry {
    func registerDictionaryActions() {
        registerApp(DictionaryAddInput.self) { session, input in
            let term = TranscriptionDictionary.cleanValue(input.term)
            session.dictionaryEntries = try await session.dictionaryStore.save(term: term, aliases: input.aliases ?? [])
            session.dictionarySuggestion = nil
            return session.dictionaryReceipt("dictionary.term", from: "", to: term,
                message: "Added “\(term)” to your dictionary.")
        }
        registerApp(DictionaryEditInput.self) { session, input in
            let entry = try await session.dictionaryEntry(input.term)
            let removed = Set((input.removeAliases ?? []).map(TranscriptionDictionary.key))
            let aliases = TranscriptionDictionary.cleanAliases(
                entry.aliases.filter { !removed.contains(TranscriptionDictionary.key($0)) } + (input.addAliases ?? []))
            let term = input.newTerm.map(TranscriptionDictionary.cleanValue) ?? entry.term
            guard term != entry.term || aliases != entry.aliases else {
                return AppActionMutation(message: "“\(entry.term)” already reads that way.")
            }
            session.dictionaryEntries = await session.dictionaryStore.update(id: entry.id, term: term, aliases: aliases)
            return session.dictionaryReceipt(term == entry.term ? "dictionary.aliases" : "dictionary.term",
                from: term == entry.term ? entry.aliases.joined(separator: ", ") : entry.term,
                to: term == entry.term ? aliases.joined(separator: ", ") : term,
                message: "Updated “\(term)” in your dictionary.")
        }
        registerApp(DictionaryRemoveInput.self) { session, input in
            let entry = try await session.dictionaryEntry(input.term)
            session.dictionaryEntries = await session.dictionaryStore.remove(id: entry.id)
            return session.dictionaryReceipt("dictionary.term", from: entry.term, to: "",
                message: "Removed “\(entry.term)” from your dictionary.")
        }
    }
}

extension EditorSession {
    /// The saved entry for a spelling, compared the way the dictionary
    /// compares words, so case and punctuation do not matter.
    func dictionaryEntry(_ term: String) async throws -> DictionaryEntry {
        if dictionaryEntries.isEmpty { dictionaryEntries = await dictionaryStore.entries() }
        let key = TranscriptionDictionary.key(term)
        guard let entry = dictionaryEntries.first(where: { TranscriptionDictionary.key($0.term) == key }) else {
            throw AppActionError("“\(term)” is not in your dictionary.")
        }
        return entry
    }

    func dictionaryReceipt(_ property: String, from before: String, to after: String, message: String) -> AppActionMutation {
        AppActionMutation(message: message,
            changes: [.init(targetID: project.id, property: property, before: before, after: after)])
    }
}
