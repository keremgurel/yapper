import Foundation

/// The creator's own spellings, and the corrections they teach it.
///
/// The entries belong to the account rather than to a project, so they are
/// loaded once and applied to every transcription from then on.
@MainActor
extension EditorSession {
    func loadDictionary() async {
        dictionaryEntries = await DictionaryStore.shared.entries()
    }

    func addDictionaryTerm(_ term: String, aliases: [String] = []) async {
        do {
            dictionaryEntries = try await DictionaryStore.shared.save(term: term, aliases: aliases)
            dictionarySuggestion = nil
            setStatus("Added “\(TranscriptionDictionary.cleanValue(term))” to your dictionary")
        } catch {
            show(error)
        }
    }

    func addDictionaryAlias(_ alias: String, to entry: DictionaryEntry) async {
        dictionaryEntries = await DictionaryStore.shared.update(
            id: entry.id,
            term: entry.term,
            aliases: entry.aliases + [alias]
        )
    }

    func updateDictionaryTerm(_ entry: DictionaryEntry, term: String) async {
        dictionaryEntries = await DictionaryStore.shared.update(
            id: entry.id,
            term: term,
            aliases: entry.aliases
        )
    }

    func removeDictionaryAlias(_ alias: String, from entry: DictionaryEntry) async {
        dictionaryEntries = await DictionaryStore.shared.update(
            id: entry.id,
            term: entry.term,
            aliases: entry.aliases.filter { $0 != alias }
        )
    }

    func removeDictionaryEntry(_ entry: DictionaryEntry) async {
        dictionaryEntries = await DictionaryStore.shared.remove(id: entry.id)
    }

    /// Offers to remember a caption fix, when the fix was one word swapped for
    /// another and the transcriber is likely to make it again.
    func noteCaptionEdit(before: String, after: String) {
        guard let correction = TranscriptionDictionary.correction(before: before, after: after) else {
            return
        }
        let known = dictionaryEntries.contains { entry in
            TranscriptionDictionary.key(entry.term) == TranscriptionDictionary.key(correction.term)
                && entry.aliases.contains {
                    TranscriptionDictionary.key($0) == TranscriptionDictionary.key(correction.heard)
                }
        }
        guard !known else { return }
        dictionarySuggestion = correction
    }

    /// Takes the offer up: the word the creator typed becomes the spelling, and
    /// what was heard becomes an alias for it.
    func acceptDictionarySuggestion() async {
        guard let correction = dictionarySuggestion else { return }
        let existing = dictionaryEntries.first {
            TranscriptionDictionary.key($0.term) == TranscriptionDictionary.key(correction.term)
        }
        await addDictionaryTerm(
            correction.term,
            aliases: (existing?.aliases ?? []) + [correction.heard]
        )
    }

    func dismissDictionarySuggestion() {
        dictionarySuggestion = nil
    }
}
