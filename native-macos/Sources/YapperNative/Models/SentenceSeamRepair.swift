import Foundation

/// Every piece the edit keeps has to be whole sentences out of one attempt.
///
/// The cleaner maps its script back a clause at a time, and each clause lands
/// on its own best match. Two clauses of one sentence can therefore land in two
/// different runs at that sentence, and what plays is the opening of one welded
/// to the ending of another:
///
///     "Alright. Another freestyle update" + "on my app. Six people purchased…"
///     "That puts it at" + "That puts us in 17 payments total…"
///
/// Measured on a real fifteen minute edit, twelve of the twenty-seven kept
/// pieces ended in the middle of a sentence like that.
///
/// So a piece that begins or ends mid-sentence is taken out to the sentence it
/// is part of, reading forwards or backwards through the recording it came
/// from, which keeps it inside one attempt. When the sentence does not close
/// within reach, the piece is cut back to the last full stop it does contain
/// instead, and if it contains none it goes: half a sentence from a take
/// nobody can finish is not worth playing.
enum SentenceSeamRepair {
    /// How far a piece may be taken out to find its sentence. Far enough for a
    /// spoken sentence, short enough that a piece cannot drag a whole abandoned
    /// attempt back in behind it.
    static let reach = 15

    static func repaired(words: [TranscriptWord], cuts: [(Int, Int)]) -> [(Int, Int)] {
        guard !words.isEmpty else { return cuts }
        var removed = flags(count: words.count, cuts: cuts)
        // One repair per pass, then the runs are worked out again. Mending a
        // piece moves the boundaries of the pieces either side of it, so a
        // sweep that fixed several at once was writing through ranges its own
        // earlier fixes had already invalidated, and left seams behind.
        // Bounded by the transcript: every pass either mends one or stops.
        for _ in 0 ..< (words.count + 1) {
            guard mend(&removed, words: words) else { break }
        }
        return ranges(from: removed)
    }

    /// Mends the first piece that needs it. Returns whether it found one.
    private static func mend(_ removed: inout [Bool], words: [TranscriptWord]) -> Bool {
        for run in runs(in: removed) {
            if run.lowerBound > 0, !endsSentence(words[run.lowerBound - 1].text) {
                if openAtASentence(run, &removed, words: words) { return true }
            }
            if run.upperBound < words.count - 1, !endsSentence(words[run.upperBound].text) {
                if closeAtASentence(run, &removed, words: words) { return true }
            }
        }
        return false
    }

    /// Takes the piece back to where its sentence started, or forward past the
    /// half sentence it opens with.
    private static func openAtASentence(
        _ run: ClosedRange<Int>,
        _ removed: inout [Bool],
        words: [TranscriptWord]
    ) -> Bool {
        var start = run.lowerBound
        while start > 0, !endsSentence(words[start - 1].text), run.lowerBound - start < reach {
            start -= 1
        }
        if start == 0 || endsSentence(words[start - 1].text) {
            guard start < run.lowerBound else { return false }
            for index in start ..< run.lowerBound { removed[index] = false }
            return true
        }
        // Too far to reach: drop the opening fragment instead.
        guard let firstWhole = run.first(where: { endsSentence(words[$0].text) }) else {
            for index in run { removed[index] = true }
            return true
        }
        guard firstWhole + 1 <= run.upperBound else {
            for index in run { removed[index] = true }
            return true
        }
        for index in run.lowerBound ... firstWhole { removed[index] = true }
        return true
    }

    /// Carries the piece on to the end of its sentence, or cuts the dangling
    /// half sentence off the end.
    private static func closeAtASentence(
        _ run: ClosedRange<Int>,
        _ removed: inout [Bool],
        words: [TranscriptWord]
    ) -> Bool {
        var end = run.upperBound
        while end < words.count - 1, !endsSentence(words[end].text), end - run.upperBound < reach {
            end += 1
        }
        if endsSentence(words[end].text) {
            guard end > run.upperBound else { return false }
            for index in (run.upperBound + 1) ... end { removed[index] = false }
            return true
        }
        guard let lastWhole = run.reversed().first(where: { endsSentence(words[$0].text) }) else {
            for index in run { removed[index] = true }
            return true
        }
        guard lastWhole < run.upperBound else { return false }
        for index in (lastWhole + 1) ... run.upperBound { removed[index] = true }
        return true
    }

    private static func runs(in removed: [Bool]) -> [ClosedRange<Int>] {
        var result: [ClosedRange<Int>] = []
        var start: Int?
        for index in removed.indices {
            if !removed[index], start == nil { start = index }
            if removed[index], let from = start {
                result.append(from ... index - 1)
                start = nil
            }
        }
        if let start { result.append(start ... removed.count - 1) }
        return result
    }

    private static func flags(count: Int, cuts: [(Int, Int)]) -> [Bool] {
        var removed = Array(repeating: false, count: count)
        for cut in cuts {
            let lower = max(0, min(cut.0, cut.1))
            let upper = min(count - 1, max(cut.0, cut.1))
            guard lower <= upper else { continue }
            for index in lower ... upper { removed[index] = true }
        }
        return removed
    }

    private static func ranges(from removed: [Bool]) -> [(Int, Int)] {
        var result: [(Int, Int)] = []
        var start: Int?
        for index in removed.indices {
            if removed[index], start == nil { start = index }
            if !removed[index], let from = start {
                result.append((from, index - 1))
                start = nil
            }
        }
        if let start { result.append((start, removed.count - 1)) }
        return result
    }

    static func endsSentence(_ text: String) -> Bool {
        text.range(of: "[.!?][\"')\\]]*$", options: .regularExpression) != nil
    }
}
