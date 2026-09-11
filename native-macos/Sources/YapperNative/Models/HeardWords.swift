import Foundation

/// What the transcriber heard, with its double takes removed.
///
/// On a long recording Deepgram occasionally emits the same word twice over
/// the same moment of audio: measured on an eighteen minute take, "on" at
/// 871.140-871.380 and again at 871.165-871.405, and the same for "a",
/// "weekly" and "plan". The speaker said each once. Nothing further down can
/// tell that from a stutter, so the edit model reads "save your students 15% on
/// on a a monthly or weekly weekly plan. Plan", and captions and cuts inherit
/// it.
///
/// Substantial overlap identifies a doubled emission. ASR timestamps have
/// jitter: a tiny overlap at the boundary can still be two real words.
enum HeardWords {
    static func withoutDoubledEmissions(_ words: [TranscriptWord]) -> [TranscriptWord] {
        var kept: [TranscriptWord] = []
        for word in words {
            if let last = kept.last,
               last.mediaID == word.mediaID,
               normalized(last.text) == normalized(word.text),
               !normalized(word.text).isEmpty,
               min(last.end, word.end) - max(last.start, word.start) >=
                   0.5 * min(last.end - last.start, word.end - word.start),
               min(last.end, word.end) > max(last.start, word.start)
            {
                // Keep whichever reaches further, so the pair's whole extent
                // survives on the one word that remains.
                if word.end > last.end { kept[kept.count - 1].end = word.end }
                continue
            }
            kept.append(word)
        }
        return kept
    }

    private static func normalized(_ text: String) -> String {
        text.lowercased().filter { $0.isLetter || $0.isNumber || $0 == "'" }
    }
}
