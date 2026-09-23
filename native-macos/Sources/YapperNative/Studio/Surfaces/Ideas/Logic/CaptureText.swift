import Foundation

/// The composer's text rules, ported from the web's `link-spans`,
/// `parse-capture`, `derive-type` and `insert-dictation`.
///
/// Every range here is in UTF-16 units, because that is what the text view's
/// selection speaks.
enum CaptureText {
    private static let urlPattern = try! NSRegularExpression(pattern: "https?://[^\\s]+", options: [.caseInsensitive])
    private static let trailing = CharacterSet(charactersIn: "),.;!?")

    /// Every link in the text, with trailing sentence punctuation left out:
    /// "see https://a.com, then" ends the link at the comma.
    static func linkRanges(in text: String) -> [NSRange] {
        let ns = text as NSString
        return urlPattern.matches(in: text, range: NSRange(location: 0, length: ns.length)).compactMap { match in
            var length = match.range.length
            while length > 0 {
                let unit = ns.character(at: match.range.location + length - 1)
                guard let scalar = Unicode.Scalar(unit), trailing.contains(scalar) else { break }
                length -= 1
            }
            return length > 0 ? NSRange(location: match.range.location, length: length) : nil
        }
    }

    static func links(in text: String) -> [String] {
        let ns = text as NSString
        return linkRanges(in: text).map { ns.substring(with: $0) }
    }

    /// The link the caret sits immediately after, so Backspace can take the
    /// whole link instead of nibbling its last character.
    static func linkEnding(at caret: Int, in text: String) -> NSRange? {
        linkRanges(in: text).first { $0.location + $0.length == caret }
    }

    /// One capture, split into the creator's words and the link, if any.
    static func parse(_ text: String) -> (note: String?, url: String?) {
        let ns = text as NSString
        guard let match = urlPattern.firstMatch(in: text, range: NSRange(location: 0, length: ns.length)) else {
            let note = text.ideasTrimmed
            return (note.isEmpty ? nil : note, nil)
        }
        // The web takes the raw match (punctuation and all) as the URL and
        // replaces its first occurrence; the same here.
        let url = ns.substring(with: match.range)
        let note = ns.replacingCharacters(in: match.range, with: " ").ideasTrimmed
        return (note.isEmpty ? nil : note, url)
    }

    /// A link with words is semi-original, a bare link is inspiration, words
    /// alone are original. The creator never picks.
    static func kind(note: String?, url: String?) -> IdeaKind {
        let hasLink = !(url ?? "").ideasTrimmed.isEmpty
        let hasWords = !(note ?? "").ideasTrimmed.isEmpty
        if hasLink && hasWords { return .semiOriginal }
        return hasLink ? .inspiration : .original
    }

    /// Splices dictated words in at the caret, replacing a selection, with the
    /// spacing inferred. Returns the new text and where the caret belongs.
    static func insertDictation(_ words: String, into current: String, selection: NSRange) -> (text: String, caret: Int) {
        let spoken = words.ideasTrimmed
        let ns = current as NSString
        guard !spoken.isEmpty else { return (current, min(selection.location, ns.length)) }

        let validStart = selection.location != NSNotFound && selection.location >= 0 && selection.location <= ns.length
        let start = validStart ? selection.location : ns.length
        let end = validStart ? min(max(selection.location + selection.length, start), ns.length) : start

        let before = ns.substring(to: start)
        let after = ns.substring(from: end)
        let needsSpaceBefore = !before.isEmpty && !(before.last?.isWhitespace ?? false)
        let closers: Set<Character> = [".", ",", ";", ":", "!", "?", ")", "]", "}"]
        let needsSpaceAfter = !after.isEmpty && !(after.first.map { $0.isWhitespace || closers.contains($0) } ?? false)

        let middle = (needsSpaceBefore ? " " : "") + spoken + (needsSpaceAfter ? " " : "")
        let caret = (before as NSString).length + (middle as NSString).length - (needsSpaceAfter ? 1 : 0)
        return (before + middle + after, caret)
    }
}

/// Link identity for de-duplication, the web's `normalizeInspoUrl`: lower
/// case scheme and host, no `www.`, no trailing slash, no fragment.
enum InspoURL {
    static func normalize(_ raw: String) -> String {
        let trimmed = raw.ideasTrimmed
        guard let components = URLComponents(string: trimmed), let scheme = components.scheme, let host = components.host else {
            return trimmed.lowercased()
        }
        var hostPart = host.lowercased()
        if hostPart.hasPrefix("www.") { hostPart.removeFirst(4) }
        var path = components.percentEncodedPath
        while path.hasSuffix("/") { path.removeLast() }
        let query = components.percentEncodedQuery.map { "?\($0)" } ?? ""
        let port = components.port.map { ":\($0)" } ?? ""
        return "\(scheme.lowercased())://\(hostPart)\(port)\(path)\(query)"
    }
}
