import Foundation

/// A spelling the creator has approved, and the ways transcription tends to get
/// it wrong.
struct DictionaryEntry: Codable, Equatable, Identifiable, Sendable {
    let id: String
    var term: String
    var aliases: [String]

    init(id: String = "local-\(UUID().uuidString)", term: String, aliases: [String] = []) {
        self.id = id
        self.term = TranscriptionDictionary.cleanValue(term)
        self.aliases = TranscriptionDictionary.cleanAliases(aliases)
    }
}

/// A one-word fix the creator made to a caption, which is worth remembering.
struct CaptionCorrection: Equatable, Sendable {
    let heard: String
    let term: String
}

/// The creator's own spellings, applied to what the transcriber heard.
///
/// Only approved spellings are ever applied: the canonical term is matched too,
/// so a lowercase result still picks up the creator's own capitalisation.
enum TranscriptionDictionary {
    static let maximumEntries = 100
    static let maximumTermLength = 80
    static let maximumAliases = 20

    /// The form two spellings are compared in: letters and numbers only, so
    /// case and punctuation cannot make two of the same word.
    static func key(_ value: String) -> String {
        String(
            value
                .precomposedStringWithCompatibilityMapping
                .lowercased()
                .filter { $0.isLetter || $0.isNumber }
                .prefix(maximumTermLength)
        )
    }

    static func cleanValue(_ value: String) -> String {
        String(
            value
                .trimmingCharacters(in: .whitespacesAndNewlines)
                .split(whereSeparator: \.isWhitespace)
                .joined(separator: " ")
                .prefix(maximumTermLength)
        )
    }

    static func cleanAliases(_ values: [String]) -> [String] {
        var seen: Set<String> = []
        var aliases: [String] = []
        for value in values {
            let alias = cleanValue(value)
            let key = key(alias)
            guard !key.isEmpty, !seen.contains(key) else { continue }
            seen.insert(key)
            aliases.append(alias)
            if aliases.count >= maximumAliases { break }
        }
        return aliases
    }

    /// The terms worth telling the transcriber about up front, deduped and
    /// bounded so the request URL stays a sane length. Everything saved still
    /// takes part in the correction pass afterwards.
    static func keyterms(_ entries: [DictionaryEntry]) -> [String] {
        var seen: Set<String> = []
        var terms: [String] = []
        var characters = 0
        for entry in entries {
            let term = cleanValue(entry.term)
            let key = key(term)
            guard !key.isEmpty, !seen.contains(key) else { continue }
            if characters + term.count > 3_000 { break }
            seen.insert(key)
            terms.append(term)
            characters += term.count
        }
        return terms
    }

    /// The words as the creator spells them.
    ///
    /// A multi-word alias keeps per-word timings when the word counts match;
    /// otherwise it collapses onto the whole stretch it replaced rather than
    /// inventing timestamps for words nobody said separately.
    static func applied(
        to words: [TranscriptWord],
        entries: [DictionaryEntry]
    ) -> [TranscriptWord] {
        guard !words.isEmpty, !entries.isEmpty else { return words }

        struct Pattern {
            let entry: DictionaryEntry
            let tokens: [String]
        }
        var patterns: [Pattern] = []
        for entry in entries {
            for value in [entry.term] + entry.aliases {
                let tokens = value
                    .split(whereSeparator: \.isWhitespace)
                    .map { key(String($0)) }
                    .filter { !$0.isEmpty }
                if !tokens.isEmpty { patterns.append(Pattern(entry: entry, tokens: tokens)) }
            }
        }
        // Longest first, so "New York City" wins over "New York".
        patterns.sort { $0.tokens.count > $1.tokens.count }

        var result: [TranscriptWord] = []
        var index = 0
        while index < words.count {
            let match = patterns.first { pattern in
                guard index + pattern.tokens.count <= words.count else { return false }
                return pattern.tokens.enumerated().allSatisfy { offset, token in
                    key(words[index + offset].text) == token
                }
            }
            guard let match else {
                result.append(words[index])
                index += 1
                continue
            }

            let source = Array(words[index ..< index + match.tokens.count])
            let canonical = match.entry.term
                .split(whereSeparator: \.isWhitespace)
                .map(String.init)
            if canonical.count == source.count {
                for (offset, word) in source.enumerated() {
                    var corrected = word
                    corrected.text = canonical[offset]
                        + (offset == source.count - 1 ? trailingPunctuation(word.text) : "")
                    result.append(corrected)
                }
            } else if let first = source.first, let last = source.last {
                result.append(
                    TranscriptWord(
                        mediaID: first.mediaID,
                        text: match.entry.term + trailingPunctuation(last.text),
                        start: first.start,
                        end: last.end
                    )
                )
            }
            index += match.tokens.count
        }
        return result
    }

    /// A caption edit worth remembering: exactly one word swapped for another.
    /// Rewrites, insertions and punctuation-only changes are left alone,
    /// because what the creator meant by them is anyone's guess.
    ///
    /// A change of capitals counts. Fixing `celpip` to `CELPIP` is the whole
    /// point of a dictionary entry — the saved term is what supplies the
    /// capitals to every transcript after it.
    static func correction(before: String, after: String) -> CaptionCorrection? {
        let from = before.split(whereSeparator: \.isWhitespace).map(String.init)
        let to = after.split(whereSeparator: \.isWhitespace).map(String.init)
        guard !from.isEmpty, from.count == to.count else { return nil }

        var correction: CaptionCorrection?
        for (index, word) in from.enumerated() {
            let heard = cleanValue(stripped(word))
            let term = cleanValue(stripped(to[index]))
            // Punctuation is not a spelling, so a comma appearing is no change.
            guard heard != term else { continue }
            guard correction == nil else { return nil }
            guard !key(heard).isEmpty, !key(term).isEmpty else { return nil }
            correction = CaptionCorrection(heard: heard, term: term)
        }
        return correction
    }

    private static func trailingPunctuation(_ value: String) -> String {
        String(value.reversed().prefix { ",.!?;:".contains($0) }.reversed())
    }

    private static func stripped(_ value: String) -> String {
        var trimmed = Substring(value)
        while let first = trimmed.first, !first.isLetter, !first.isNumber {
            trimmed = trimmed.dropFirst()
        }
        while let last = trimmed.last, !last.isLetter, !last.isNumber {
            trimmed = trimmed.dropLast()
        }
        return String(trimmed)
    }
}
