import Foundation

/// `@file name.mp4` mentions, the way an editor types them.
///
/// File names contain spaces, so a mention cannot be "the `@` up to the next
/// space". While it is being typed the query is everything after the `@` the
/// caret is standing in; once typed, a mention is recognised by matching it
/// against the library's real names. Nothing else can be mentioned, which is
/// why nothing ever has to be escaped.
///
/// Ported from the web editor so both apps read the same sentence the same way.
enum OverlayMention {
    /// The mention the caret is inside, as a slice of the text.
    struct Span: Equatable, Sendable {
        /// Offset of the `@`.
        let from: Int
        /// Offset just past the caret.
        let to: Int
        /// What has been typed after the `@`, which may contain spaces.
        let query: String
    }

    /// How many names the list offers at once. Generous because the list
    /// scrolls: the cap is here to keep the ranking meaningful on a huge bin,
    /// not to decide how many you are allowed to see.
    static let maximumSuggestions = 40

    /// The mention being typed at `caret`, or nil.
    ///
    /// The `@` has to start the text or follow a space, so an email address is
    /// never mistaken for a mention.
    static func mention(in value: String, caret: Int) -> Span? {
        let characters = Array(value)
        let caret = min(max(0, caret), characters.count)
        let before = characters[..<caret]
        guard let at = before.lastIndex(of: "@") else { return nil }
        if at > 0, !characters[at - 1].isWhitespace { return nil }
        // A new line ends a mention; a space does not, since names contain them.
        let query = String(characters[(at + 1) ..< caret])
        guard !query.contains(where: \.isNewline) else { return nil }
        return Span(from: at, to: caret, query: query)
    }

    /// True once a mention names a real file and has been closed with a space.
    ///
    /// Accepting a suggestion writes `@the-file.png ` and leaves the caret after
    /// it — which still reads as a mention being typed, whose query happens to
    /// name exactly one file. Without this the list reopens on the file just
    /// chosen and there is no way out of it but deleting the word.
    static func isFinished(_ span: Span, names: [String]) -> Bool {
        guard span.query.hasSuffix(" ") else { return false }
        let named = span.query.trimmingCharacters(in: .whitespaces)
        guard !named.isEmpty else { return false }
        return names.contains { $0.caseInsensitiveCompare(named) == .orderedSame }
    }

    /// Names worth offering for a query, in the library's own order.
    static func suggestions(names: [String], query: String) -> [String] {
        let trimmed = query.trimmingCharacters(in: .whitespaces).lowercased()
        guard !trimmed.isEmpty else { return names }
        return names.filter { $0.lowercased().contains(trimmed) }
    }

    /// Puts `name` into the text where the mention was being typed, and says
    /// where the caret goes afterwards.
    static func applying(
        _ name: String,
        to value: String,
        span: Span
    ) -> (value: String, caret: Int) {
        let characters = Array(value)
        let head = String(characters[..<span.from]) + "@" + name + " "
        let tail = String(characters[min(span.to, characters.count)...])
        return (head + tail, head.count)
    }

    /// Which of the library's files the finished text actually names.
    ///
    /// Matched longest name first, so `@intro.mp4` found inside the text of
    /// `@intro.mp4.bak` never claims it.
    static func mentioned(in value: String, names: [String]) -> [String] {
        var remaining = value.lowercased()
        var found: Set<String> = []
        for name in names.sorted(by: { $0.count > $1.count }) {
            let needle = "@" + name.lowercased()
            guard remaining.contains(needle) else { continue }
            found.insert(name)
            remaining = remaining.replacingOccurrences(of: needle, with: " ")
        }
        // Back in the library's order, so the model is given them in the order
        // the creator sees them.
        return names.filter { found.contains($0) }
    }
}
