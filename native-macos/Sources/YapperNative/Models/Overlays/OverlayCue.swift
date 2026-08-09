import Foundation

/// "Show the icon right as I say Instagram."
///
/// A quote is the wrong thing to anchor that on: it names a sentence, and the
/// icon belongs on one word inside it. But a single word is also the wrong
/// thing to search a whole transcript for, because "Instagram" is said four
/// times and only one of them is the moment being described.
///
/// So both. The quote finds the sentence, and this finds the word inside it.
/// Searching ten words instead of nine hundred is what makes a one-word anchor
/// safe to act on.
enum OverlayCue {
    /// How far before the word is heard the overlay goes on screen.
    ///
    /// The eye is slower than the ear. An overlay that appears on the first
    /// frame of a word reads as late, every time, and this is roughly the beat
    /// an editor leaves without thinking about it.
    static let leadIn = 0.12

    /// Two short tokens count as the same word from this length on, so a cue of
    /// "Instagram" still lands on "Instagram's".
    private static let stemLength = 4

    /// The transcript index of the word a cue points at, or nil when the cue is
    /// not in the span.
    ///
    /// A miss is not a failure. The caller falls back to the start of the quote,
    /// which is where the overlay would have gone before cues existed.
    static func anchor(
        in words: [TranscriptWord],
        span: ClosedRange<Int>,
        cue: String
    ) -> Int? {
        let trimmed = cue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, words.indices.contains(span.lowerBound) else { return nil }

        // Punctuation-only words cannot be matched against, but they keep their
        // place in the transcript's own indices.
        let source: [(token: String, index: Int)] = span.compactMap { index in
            guard words.indices.contains(index) else { return nil }
            let token = OverlayPlan.normalized(words[index].text)
            return token.isEmpty ? nil : (token, index)
        }
        let wanted = trimmed
            .split(whereSeparator: \.isWhitespace)
            .map { OverlayPlan.normalized(String($0)) }
            .filter { !$0.isEmpty }

        guard !wanted.isEmpty, source.count >= wanted.count else { return nil }

        var best: (offset: Int, hits: Int)?
        for offset in 0 ... (source.count - wanted.count) {
            var hits = 0
            for step in wanted.indices where sameWord(source[offset + step].token, wanted[step]) {
                hits += 1
            }
            if hits == wanted.count { return source[offset].index }
            if best == nil || hits > best!.hits { best = (offset, hits) }
        }
        // A cue is one or two words, so this rounds up to "all of them" for the
        // short ones. Nothing partial should move an overlay off the moment the
        // quote already found.
        guard let best, Double(best.hits) >= (Double(wanted.count) * 0.6).rounded(.up) else {
            return nil
        }
        return source[best.offset].index
    }

    /// When an overlay cued on this word should come on screen, never before
    /// the video starts.
    static func start(forWordAt time: Double) -> Double {
        max(0, time - leadIn)
    }

    /// True when two normalised tokens are the same word.
    ///
    /// Transcripts are full of possessives and plurals the model drops when it
    /// copies a name out, and "instagram" missing "instagram's" would send the
    /// icon back to the top of the sentence.
    private static func sameWord(_ a: String, _ b: String) -> Bool {
        if a == b { return true }
        let shorter = a.count <= b.count ? a : b
        let longer = a.count <= b.count ? b : a
        guard shorter.count >= stemLength else { return false }
        return longer.hasPrefix(shorter)
    }
}
