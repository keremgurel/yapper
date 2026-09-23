import Foundation

/// `GET /api/transcription-dictionary`: every saved spelling, newest first.
struct DictionaryListResponse: Decodable, Equatable {
    let entries: [DictionaryEntry]
}

/// `POST /api/transcription-dictionary` and `PATCH .../[id]`: the one entry
/// as the server saved it.
struct DictionaryEntryResponse: Decodable, Equatable {
    let entry: DictionaryEntry
}

/// The body both writes take. The server cleans it again; cleaning here keeps
/// what the creator sees in step with what gets stored.
struct DictionaryEntryInput: Encodable, Equatable {
    let term: String
    let aliases: [String]

    init(term: String, aliases: [String]) {
        self.term = TranscriptionDictionary.cleanValue(term)
        self.aliases = TranscriptionDictionary.cleanAliases(aliases)
    }
}

enum DictionaryCopy {
    static let capacity = TranscriptionDictionary.maximumEntries

    /// The route's error codes, in the creator's terms.
    static func message(for error: Error) -> String {
        guard let api = error as? StudioAPIError else { return error.localizedDescription }
        switch api.code {
        case "bad_term": return "A spelling needs at least one letter or number."
        case "dictionary_full": return "Your dictionary is full. Remove a word to add another."
        case "duplicate_term": return "You already have that spelling saved."
        case "account_changed": return "You switched accounts. Reload the dictionary and try again."
        default: return api.message
        }
    }
}
