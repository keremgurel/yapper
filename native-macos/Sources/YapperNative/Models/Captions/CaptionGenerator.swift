import Foundation

/// A kept transcript word, already placed on the edited timeline. The generator
/// groups these into cards; it needs the timeline position only to spot real
/// pauses, while the card itself is stored against the recording.
struct CaptionSourceWord: Equatable, Sendable {
    var mediaID: UUID
    var text: String
    var sourceStart: Double
    var sourceEnd: Double
    var timelineStart: Double
    var timelineEnd: Double
}

/// Groups spoken words into caption cards.
enum CaptionGenerator {
    /// Character budget for one Auto card, tuned so a card never needs more
    /// than two lines at the default size.
    static let maximumCharacters = 34
    /// Word budget for one Auto card.
    static let maximumWords = 4
    /// Longest an Auto card may stay on screen before it is split.
    static let maximumSeconds = 2.35
    /// An edited gap this long reads as a real pause, so the card breaks there
    /// whether or not it is full.
    static let pauseSeconds = 0.48

    /// Transcriber word starts lag the true onset slightly, so a card anchored
    /// exactly at its first word reads late. Each card takes this much of a
    /// head start, never crossing the previous word.
    static let leadSeconds = 0.025
    /// Held a beat past the last word so the eye finishes the line.
    static let tailSeconds = 0.10

    /// Builds cards from kept, timeline-ordered words.
    ///
    /// With `wordsPerCard` at zero the words group by phrase: a card breaks on a
    /// real pause, at a sentence end, or once it exceeds the character, word or
    /// duration budget. With a count set, cards are exactly that many words
    /// (still breaking on real pauses and at media boundaries), which gives the
    /// one-word-at-a-time look.
    static func captions(
        from words: [CaptionSourceWord],
        wordsPerCard: Int
    ) -> [ProjectCaption] {
        var captions: [ProjectCaption] = []
        var group: [CaptionSourceWord] = []
        var previousWordSourceEnd: [UUID: Double] = [:]

        func flush() {
            guard let first = group.first, let last = group.last else { return }
            let previousEnd = previousWordSourceEnd[first.mediaID] ?? 0
            captions.append(
                ProjectCaption(
                    mediaID: first.mediaID,
                    text: group.map(\.text).joined(separator: " "),
                    sourceStart: max(previousEnd, first.sourceStart - leadSeconds),
                    sourceEnd: max(first.sourceStart + 0.12, last.sourceEnd + tailSeconds)
                )
            )
            previousWordSourceEnd[first.mediaID] = last.sourceEnd
            group.removeAll(keepingCapacity: true)
        }

        for word in words {
            if let last = group.last, shouldBreak(before: word, after: last, group: group, wordsPerCard: wordsPerCard) {
                flush()
            }
            group.append(word)
        }
        flush()
        return captions
    }

    private static func shouldBreak(
        before word: CaptionSourceWord,
        after last: CaptionSourceWord,
        group: [CaptionSourceWord],
        wordsPerCard: Int
    ) -> Bool {
        if word.mediaID != last.mediaID { return true }
        if word.timelineStart - last.timelineEnd > pauseSeconds { return true }
        // A cut removes recording seconds without leaving a timeline gap, so
        // two words either side of one look adjacent while their anchors are
        // far apart. A card must never span that: anchored across the removed
        // region, it maps to nothing and vanishes from the video entirely.
        let removed = (word.sourceStart - last.sourceEnd) - (word.timelineStart - last.timelineEnd)
        if removed > 0.05 { return true }
        if wordsPerCard > 0 {
            return breaksFixedCard(group: group, next: word, wordsPerCard: wordsPerCard)
        }

        if group.count >= maximumWords { return true }
        if closesSentence(last.text) { return true }
        let joined = group.map(\.text).joined(separator: " ")
        if joined.count + 1 + word.text.count > maximumCharacters { return true }
        if let first = group.first, word.sourceEnd - first.sourceStart > maximumSeconds { return true }
        return false
    }

    /// Words that belong to whatever comes after them.
    ///
    /// A card counted out in threes lands wherever the third word falls, and on
    /// a real edit that is regularly mid-phrase: "I'll do the" / "full cost
    /// versus" / "revenue then." Ending a card on one of these reads as a
    /// sentence cut in half, and the reader spends the next card catching up.
    /// Only the words that point at whatever comes next: an article with no
    /// noun, a preposition with no object. A card may end on a verb or an
    /// adverb and still read; a card ending on "the" cannot, and at three words
    /// a card there is not room to be fussier than this.
    static let clingingWords: Set<String> = [
        "a", "an", "the", "my", "our", "your", "its", "their", "his", "her",
        "this", "these", "those", "of", "to", "in", "for", "with", "at", "on",
        "from", "by", "into", "over", "than", "as", "and", "or", "but",
    ]

    /// Whether a fixed-size card is finished.
    ///
    /// Counted cards keep their count, give or take a word, so the punchy
    /// short-form look survives. What they no longer do is end on a word that
    /// belongs to the next phrase: the card takes one more word, or stops one
    /// earlier, whichever lands somewhere a reader would pause.
    static func breaksFixedCard(
        group: [CaptionSourceWord],
        next: CaptionSourceWord,
        wordsPerCard: Int
    ) -> Bool {
        guard let last = group.last else { return false }
        if closesSentence(last.text) { return true }
        if group.count >= wordsPerCard + 1 { return true }
        if group.count >= wordsPerCard {
            // Full, but ending here would split a phrase. One more word is
            // allowed, and only one.
            return !clings(last.text)
        }
        guard wordsPerCard > 1, group.count == wordsPerCard - 1 else { return false }
        // One short of full: stopping here beats going on when the word that
        // would fill the card clings to the one after it.
        return clings(next.text) && !clings(last.text)
    }

    private static func clings(_ text: String) -> Bool {
        let word = text.lowercased().filter { $0.isLetter || $0 == "'" }
        guard !word.isEmpty else { return false }
        if text.hasSuffix(",") || text.hasSuffix(";") || text.hasSuffix(":") { return false }
        return clingingWords.contains(word)
    }

    private static func closesSentence(_ text: String) -> Bool {
        text.hasSuffix(".") || text.hasSuffix("!") || text.hasSuffix("?")
    }
}
