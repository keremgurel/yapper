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
    /// The stretch of recording the clip this word plays from covers.
    ///
    /// A card may not span two clips, and may not reach outside its own: it is
    /// anchored to a stretch of the recording, and a stretch holding seconds
    /// that are no longer in the video maps to nothing and never appears.
    var clip: ClosedRange<Double>?
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
    /// A counted card holds its count through the small gaps between phrases,
    /// so the break has to be a real stop rather than a breath.
    static let countedPauseSeconds = 0.7

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
        /// The words a counted card is being cut from, filled a run at a time.
        var run: [CaptionSourceWord] = []

        func flush() {
            guard let first = group.first, let last = group.last else { return }
            let previousEnd = previousWordSourceEnd[first.mediaID] ?? 0
            let span = clamped(
                start: max(previousEnd, first.sourceStart - leadSeconds),
                end: max(first.sourceStart + 0.12, last.sourceEnd + tailSeconds),
                to: first.clip
            )
            captions.append(
                ProjectCaption(
                    mediaID: first.mediaID,
                    text: group.map(\.text).joined(separator: " "),
                    sourceStart: span.start,
                    sourceEnd: span.end
                )
            )
            previousWordSourceEnd[first.mediaID] = last.sourceEnd
            group.removeAll(keepingCapacity: true)
        }

        /// Cuts a whole run into cards of no more than the count, as evenly as
        /// the run divides. See CaptionCardSizes.
        func flushRun() {
            guard !run.isEmpty else { return }
            var index = 0
            for size in CaptionCardSizes.sizes(for: run.map(\.text), perCard: wordsPerCard) {
                group = Array(run[index ..< min(run.count, index + size)])
                index += size
                flush()
            }
            run.removeAll(keepingCapacity: true)
        }

        for word in words {
            guard wordsPerCard > 0 else {
                if let last = group.last,
                   shouldBreak(before: word, after: last, group: group, wordsPerCard: wordsPerCard) {
                    flush()
                }
                group.append(word)
                continue
            }
            // A counted card is cut from a run, and a run ends only where it
            // has to: another recording, a real stop, or a cut through the
            // middle. Anything else and the count stops meaning anything.
            if let last = run.last, endsRun(before: word, after: last) { flushRun() }
            run.append(word)
        }
        flushRun()
        flush()
        return captions
    }

    /// Where a counted run has to end, whatever the count says.
    private static func endsRun(before word: CaptionSourceWord, after last: CaptionSourceWord) -> Bool {
        if word.mediaID != last.mediaID { return true }
        if crossesACut(word, after: last) { return true }
        return word.timelineStart - last.timelineEnd > countedPauseSeconds
    }

    /// Whether the join between two words is a cut.
    ///
    /// Asked of the clips rather than worked out from the timings, because the
    /// timings cannot answer it. A transcriber's word extents are generous and
    /// run together, so the silence a cut removes regularly sits inside the
    /// last word of one phrase and the first word of the next, with no gap
    /// between them to measure. Measured on a real edit: "learn." ran to 61.000
    /// and "Choose" began at 61.000, while the video jumped 60.740 to 61.060.
    /// A card was built across the join, anchored to a third of a second that
    /// is not in the video any more, and never appeared.
    private static func crossesACut(_ word: CaptionSourceWord, after last: CaptionSourceWord) -> Bool {
        guard let clip = word.clip, let previous = last.clip else { return false }
        return clip != previous
    }

    /// The card's own clip, and nothing past its edges.
    ///
    /// The head start and the beat held at the end are for the reader, and a
    /// transcriber's word extents are generous enough that either can reach
    /// past the clip the words play from. A card is placed by the midpoint of
    /// the stretch it claims, so a tenth of a second of overhang is enough to
    /// place it in removed footage and drop it from the video. Measured: a card
    /// reading "you" was lost to seventeen milliseconds.
    private static func clamped(
        start: Double,
        end: Double,
        to clip: ClosedRange<Double>?
    ) -> (start: Double, end: Double) {
        guard let clip else { return (start, end) }
        let from = min(max(start, clip.lowerBound), clip.upperBound)
        let to = max(from, min(end, clip.upperBound))
        return (from, to > from ? to : min(clip.upperBound, from + 0.12))
    }

    private static func shouldBreak(
        before word: CaptionSourceWord,
        after last: CaptionSourceWord,
        group: [CaptionSourceWord],
        wordsPerCard: Int
    ) -> Bool {
        if word.mediaID != last.mediaID { return true }
        if crossesACut(word, after: last) { return true }
        let pause = wordsPerCard > 0 ? countedPauseSeconds : pauseSeconds
        if word.timelineStart - last.timelineEnd > pause { return true }
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
        next _: CaptionSourceWord,
        wordsPerCard: Int
    ) -> Bool {
        guard let last = group.last else { return false }
        // A count is a promise: asking for three words a card and getting a
        // one, a two and a four is not the look anybody picked. So the count is
        // what breaks a card, and the only thing allowed to change it is a
        // word that cannot be left at the end of a line — one more word, once.
        // Sentence ends do not break a counted card: a real pause between two
        // words does, and in speech that is where the sentences are anyway.
        if group.count >= wordsPerCard + 1 { return true }
        if group.count >= wordsPerCard { return !clings(last.text) }
        return false
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
