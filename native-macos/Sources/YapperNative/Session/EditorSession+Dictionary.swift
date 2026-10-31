import Foundation

/// The creator's own spellings, and the corrections they teach it.
///
/// The entries belong to the account rather than to a project, so they are
/// loaded once and applied to every transcription from then on.
@MainActor
extension EditorSession {
    func loadDictionary() async {
        dictionaryEntries = await dictionaryStore.entries()
    }

    // The panel's controls run the same actions as Chirpy. Values are cleaned
    // first so the panel keeps accepting what it always has.

    func addDictionaryTerm(_ term: String, aliases: [String] = []) async {
        let aliases = TranscriptionDictionary.cleanAliases(aliases)
        await performAppAction(DictionaryAddInput(term: TranscriptionDictionary.cleanValue(term),
                                                  aliases: aliases.isEmpty ? nil : aliases))
    }

    func addDictionaryAlias(_ alias: String, to entry: DictionaryEntry) async {
        await performAppAction(DictionaryEditInput(term: entry.term, newTerm: nil,
            addAliases: [TranscriptionDictionary.cleanValue(alias)], removeAliases: nil))
    }

    func updateDictionaryTerm(_ entry: DictionaryEntry, term: String) async {
        await performAppAction(DictionaryEditInput(term: entry.term, newTerm: TranscriptionDictionary.cleanValue(term),
            addAliases: nil, removeAliases: nil))
    }

    func removeDictionaryAlias(_ alias: String, from entry: DictionaryEntry) async {
        await performAppAction(DictionaryEditInput(term: entry.term, newTerm: nil, addAliases: nil, removeAliases: [alias]))
    }

    func removeDictionaryEntry(_ entry: DictionaryEntry) async {
        await performAppAction(DictionaryRemoveInput(term: entry.term))
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
