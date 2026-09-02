import Foundation

/// The last word on a set of cuts, read as the viewer will hear them rather
/// than as a set of takes.
///
/// There are two ways cuts arrive here and they deserve opposite treatment.
///
/// The cleaner read the whole transcript, chose which run at each line to keep,
/// and mapped its script back to whole contiguous takes. Its cuts land inside
/// a spoken sentence on purpose, because that is where a false start ends: a
/// transcriber writes "Navigate to practice celpip.ca and go to practice
/// celpip.ca and click words in the navigation bar." as one sentence, so the
/// abandoned "and go" has no full stop after it. Anything that reads that
/// punctuation as an attempt boundary and reaches back to it undoes the edit.
/// Measured on that recording, five false starts came back that way, and every
/// one of them is visible in the finished transcript. So an AI edit is only
/// ever narrowed here, never widened.
///
/// The local fallback has no such judgement behind it. It matches text, so it
/// really can leave half a sentence playing, and the seam and lost line passes
/// earn their place. Those passes feed each other: mending a seam regularly
/// leaves two runs at the same line side by side, which is what the repeat
/// passes take out; taking a repeat out can leave the run before it ending
/// mid-sentence, which is a seam again. So they run until the answer stops
/// changing, and every round ends with the seam pass, because that is the one
/// whose result must hold.
///
/// This lives here, whole, so that what the tests run is what the editor runs.
/// It did not, once: the service returned early from a settled round while the
/// test applied one more seam pass by hand, so the test read zero seams on cuts
/// the app would have shipped with four.
enum EditFinishing {
    static let rounds = 4

    /// Cuts the cleaner chose. Only the passes that remove more run, so a take
    /// the model rejected cannot come back.
    static func aiCuts(_ cuts: [(Int, Int)], words: [TranscriptWord]) -> [(Int, Int)] {
        var settled = cuts
        for _ in 0 ..< rounds {
            let deduped = KeptStreamRepair.withoutRepeatedSentences(words: words, cuts: settled)
            let unstuttered = KeptStreamRepair.withoutImmediateRepeats(words: words, cuts: deduped)
            let undoubled = KeptStreamRepair.withoutDoubledPhrases(words: words, cuts: unstuttered)
            let withoutOrphans = withoutDetachedDiscourseStarters(words: words, cuts: undoubled)
            if same(withoutOrphans, settled) { break }
            settled = withoutOrphans
        }
        return settled
    }

    /// Drops a one-word connector stranded between rejected takes.
    ///
    /// The cleaner once kept only the 160 ms "And" at the start of an
    /// abandoned attempt, cut the rest of that attempt, then kept the complete
    /// next attempt after 6.8 seconds. Silence removal made the orphan sound as
    /// though it belonged to the final take. This is deliberately narrow: it
    /// only removes a short discourse starter already surrounded by the
    /// cleaner's cuts and detached from the following word by audible space.
    /// It never restores anything the cleaner rejected.
    private static func withoutDetachedDiscourseStarters(
        words: [TranscriptWord],
        cuts: [(Int, Int)]
    ) -> [(Int, Int)] {
        guard words.count >= 3, !cuts.isEmpty else { return cuts }
        var removed = Array(repeating: false, count: words.count)
        for cut in cuts {
            let lower = max(0, min(cut.0, cut.1))
            let upper = min(words.count - 1, max(cut.0, cut.1))
            guard lower <= upper else { continue }
            for index in lower ... upper { removed[index] = true }
        }

        let starters = Set(["and", "but", "so", "because", "then", "also", "plus"])
        for index in 1 ..< words.count - 1 where !removed[index] {
            guard removed[index - 1], removed[index + 1],
                  words[index].end - words[index].start <= 0.35,
                  words[index + 1].start - words[index].end >= 0.45,
                  starters.contains(normalize(words[index].text)),
                  words[index].text.range(of: "[.!?]$", options: .regularExpression) == nil
            else { continue }
            removed[index] = true
        }

        var result: [(Int, Int)] = []
        var start: Int?
        for index in words.indices {
            if removed[index], start == nil { start = index }
            if !removed[index], let runStart = start {
                result.append((runStart, index - 1))
                start = nil
            }
        }
        if let start { result.append((start, words.count - 1)) }
        return result
    }

    /// Cuts the local text matcher chose, with nothing behind them but string
    /// similarity. Everything runs.
    static func cuts(_ cuts: [(Int, Int)], words: [TranscriptWord]) -> [(Int, Int)] {
        var settled = SentenceSeamRepair.repaired(words: words, cuts: cuts)
        for _ in 0 ..< rounds {
            let deduped = KeptStreamRepair.withoutRepeatedSentences(words: words, cuts: settled)
            let unstuttered = KeptStreamRepair.withoutImmediateRepeats(words: words, cuts: deduped)
            let undoubled = KeptStreamRepair.withoutDoubledPhrases(words: words, cuts: unstuttered)
            let whole = SentenceSeamRepair.repaired(words: words, cuts: undoubled)
            if same(whole, settled) { break }
            settled = whole
        }
        // Then, once: keeping one run at a line is the point, dropping all of
        // them is not.
        let restored = LostLineRepair.restoringLostLines(words: words, cuts: settled)
        guard !same(restored, settled) else {
            return SentenceSeamRepair.repaired(words: words, cuts: settled)
        }
        // What came back has to answer to the same passes as everything else.
        // Restoring last and stopping meant a line put back beside one already
        // there was heard twice.
        let deduped = KeptStreamRepair.withoutRepeatedSentences(words: words, cuts: restored)
        let unstuttered = KeptStreamRepair.withoutImmediateRepeats(words: words, cuts: deduped)
        return SentenceSeamRepair.repaired(words: words, cuts: unstuttered)
    }

    private static func same(_ a: [(Int, Int)], _ b: [(Int, Int)]) -> Bool {
        a.count == b.count && zip(a, b).allSatisfy { $0.0 == $1.0 && $0.1 == $1.1 }
    }

    private static func normalize(_ text: String) -> String {
        text.lowercased().filter { $0.isLetter || $0.isNumber || $0 == "'" }
    }
}
