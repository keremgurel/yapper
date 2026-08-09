import Foundation

/// Words the model asked to put on screen, before anything has checked them
/// against the transcript.
struct TextRequest: Equatable, Sendable {
    /// What it says.
    let text: String
    /// The sentence it belongs to, copied from the transcript.
    let quote: String
    /// The word inside that sentence it appears on.
    let cue: String?
    /// How long it stays. See `TextHold`.
    let until: String?

    init(text: String, quote: String, cue: String? = nil, until: String? = nil) {
        self.text = text
        self.quote = quote
        self.cue = cue
        self.until = until
    }
}

/// How long a piece of on-screen text stays up.
///
/// Every one of these is expressed in the speaker's own words rather than in
/// seconds, for the same reason quotes are: a model asked to hold something
/// "for 6 seconds" has counted the transcript, and it counts badly. Asked to
/// hold it until some words are spoken, it only has to copy them.
enum TextHold: Equatable, Sendable {
    /// To the end of its own quoted sentence. What a label pinned to a phrase
    /// wants, and the default.
    case quote
    /// Until the next piece of text arrives, so a series of labels replaces
    /// itself one at a time.
    case next
    /// To the end of the video.
    case end
    /// Until the quoted words are spoken. This is what "hold them all until I
    /// finish the list" means.
    case untilQuote(String)

    init(_ raw: String?) {
        guard let raw else {
            self = .quote
            return
        }
        switch raw.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() {
        case "", "quote", "sentence": self = .quote
        case "next": self = .next
        case "end", "video", "the end": self = .end
        default: self = .untilQuote(raw)
        }
    }
}

/// A piece of text that has been found in the transcript, as a run of words.
struct PlacedTextSpan: Equatable, Sendable {
    let text: String
    /// Index of the first word of the sentence it was quoted from.
    let firstWord: Int
    /// Index of the last word of that sentence, inclusive.
    let lastWord: Int
    /// The word it appears on: the quote's first word unless a cue named
    /// another inside it.
    let anchorWord: Int
    let hold: TextHold
    /// The last word it stays up for, when the hold named words to wait for.
    /// Resolved here, where the transcript is, rather than left to the caller.
    let holdUntilWord: Int?

    init(
        text: String,
        firstWord: Int,
        lastWord: Int,
        anchorWord: Int? = nil,
        hold: TextHold = .quote,
        holdUntilWord: Int? = nil
    ) {
        self.text = text
        self.firstWord = firstWord
        self.lastWord = lastWord
        self.anchorWord = anchorWord ?? firstWord
        self.hold = hold
        self.holdUntilWord = holdUntilWord
    }
}

/// Matching asked-for text back onto the words that were actually said.
///
/// The same rule the overlays follow: the model quotes, the transcript decides.
/// Text whose quote is not really in the transcript is dropped rather than
/// placed at a guessed second, because a label on the wrong sentence is worse
/// than no label.
enum TextPlan {
    /// The longest a label may be. Past this it has stopped being a label and
    /// become a caption, and the video already has those.
    static let maximumLength = 60

    static func spans(words: [TranscriptWord], requests: [TextRequest]) -> [PlacedTextSpan] {
        var result: [PlacedTextSpan] = []
        for request in requests {
            let text = request.text.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !text.isEmpty, text.count <= maximumLength else { continue }
            guard
                let span = OverlayPlan.quoteSpan(in: words, quote: request.quote),
                words.indices.contains(span.lowerBound),
                words.indices.contains(span.upperBound)
            else { continue }
            // A cue outside its own sentence is not worth losing the text over:
            // the quote already found the moment.
            let anchor = request.cue
                .flatMap { OverlayCue.anchor(in: words, span: span, cue: $0) }
                ?? span.lowerBound

            let hold = TextHold(request.until)
            var holdUntil: Int?
            if case let .untilQuote(quote) = hold {
                // Held until words that are not in the transcript falls back to
                // the sentence it came from, which is what leaving `until` out
                // would have done. Better than holding it forever on a quote
                // nobody said.
                holdUntil = OverlayPlan.quoteSpan(in: words, quote: quote)?.upperBound
            }
            result.append(
                PlacedTextSpan(
                    text: text,
                    firstWord: span.lowerBound,
                    lastWord: span.upperBound,
                    anchorWord: anchor,
                    hold: hold,
                    holdUntilWord: holdUntil
                )
            )
        }
        // In the order they are spoken, so "until the next one" means the next
        // one on screen rather than the next one the model happened to list.
        return result.sorted { ($0.anchorWord, $0.firstWord) < ($1.anchorWord, $1.firstWord) }
    }
}
