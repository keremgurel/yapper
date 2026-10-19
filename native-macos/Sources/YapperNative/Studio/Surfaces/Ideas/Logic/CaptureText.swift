import Foundation

/// The composer's text rules, ported from the web's `link-spans`,
/// `parse-capture` and `derive-type`. Dictation goes in through
/// `DictationInsertion`, which Chirpy's box shares.
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
