import Foundation

/// Checks the edit against what the viewer will actually hear.
///
/// Everything upstream reasons about which takes to keep. This reads the words
/// that survived, in order, the way they will play. A speaker who runs a line
/// twice and gets cut halfway through the first attempt leaves the finished
/// video saying the same thing twice in a row, which no amount of thinking
/// about takes will notice, because each half came from a take that was chosen
/// for good reasons.
///
/// Measured on a fifteen minute recording: "And we're currently at 324 users,
/// we're at 324 users, which sounds absolutely insane to me."
enum KeptStreamRepair {
    /// Long enough that hearing it twice is the speaker repeating themselves
    /// rather than ordinary English reusing a phrase.
    static let repeatedRun = 3
    /// How far apart the two copies can be and still be one stumble. Beyond
    /// this they are two mentions of the same thing, which is fine.
    static let stumbleGap = 12

    /// A sentence has to be at least this long before two of them being alike
    /// means anything. "Alright." and "So yeah." are not repeats.
    static let repeatedSentenceWords = 5
    /// How alike two sentences have to be. A speaker running a line again
    /// changes a word or two; below this they are two different sentences that
    /// happen to start the same way.
    static let sameSentence = 0.75
    /// How much of the shorter sentence the shared opening has to be.
    static let sameOpening = 0.7
    /// How far apart two attempts at a line can be. Beyond this the speaker has
    /// moved on and come back, which is a callback, not a stumble.
    static let attemptsApart = 3

    /// The same cuts, with the earlier of two attempts at one sentence gone.
    ///
    /// The stumble pass reads a few words at a time and catches a line the
    /// speaker restarted mid-flow. This reads whole sentences, because the
    /// cleaner also keeps two complete runs at the same line: measured on a
    /// real recording, "And the two users that messaged me ended the
    /// conversation happy and thankful." played and then, forty words later,
    /// "And the two users that messaged me ended the conversation happy and
    /// might even get some reviews out of them." The later one is the take the
    /// speaker settled on, so the earlier one goes.
    static func withoutRepeatedSentences(
        words: [TranscriptWord],
        cuts: [(Int, Int)]
    ) -> [(Int, Int)] {
        var removed = removedFlags(count: words.count, cuts: cuts)
        let kept = words.indices.filter { !removed[$0] }
        guard kept.count > repeatedSentenceWords else { return cuts }

        var sentences: [[Int]] = []
        var current: [Int] = []
        for index in kept {
            current.append(index)
            if isSentenceEnd(words[index].text) {
                sentences.append(current)
                current = []
            }
        }
        if !current.isEmpty { sentences.append(current) }

        for first in sentences.indices {
            let earlier = tokens(of: sentences[first], in: words)
            guard earlier.count >= repeatedSentenceWords else { continue }
            for second in (first + 1) ..< min(first + 1 + attemptsApart, sentences.count) {
                let later = tokens(of: sentences[second], in: words)
                guard later.count >= repeatedSentenceWords else { continue }
                guard isSameLine(earlier, later) else { continue }
                for index in sentences[first] { removed[index] = true }
                return withoutRepeatedSentences(words: words, cuts: ranges(from: removed))
            }
        }
        return cuts
    }

    private static func tokens(of sentence: [Int], in words: [TranscriptWord]) -> [String] {
        sentence.map { normalize(words[$0].text) }.filter { !$0.isEmpty }
    }

    /// Whether these are two runs at one line.
    ///
    /// A restart is recognisable by its opening: the speaker begins the same
    /// sentence and finishes it differently. "...ended the conversation happy
    /// and thankful." against "...ended the conversation happy and might even
    /// get some reviews out of them." shares twelve opening words and then
    /// parts, which counting shared words alone scores too low to notice.
    ///
    /// Two sentences that merely open alike part almost immediately, so the
    /// shared opening has to be most of the shorter one.
    static func isSameLine(_ a: [String], _ b: [String]) -> Bool {
        guard !a.isEmpty, !b.isEmpty else { return false }
        let opening = zip(a, b).prefix { $0 == $1 }.count
        if opening >= repeatedSentenceWords,
           Double(opening) / Double(min(a.count, b.count)) >= sameOpening
        {
            return true
        }
        return sharedWords(a, b) >= sameSentence
    }

    /// How much of the longer sentence the shorter one also says, in any order.
    static func sharedWords(_ a: [String], _ b: [String]) -> Double {
        guard !a.isEmpty, !b.isEmpty else { return 0 }
        var counts: [String: Int] = [:]
        for token in a { counts[token, default: 0] += 1 }
        var shared = 0
        for token in b where (counts[token] ?? 0) > 0 {
            counts[token]! -= 1
            shared += 1
        }
        return Double(shared) / Double(max(a.count, b.count))
    }

    /// The same cuts, with the first of two consecutive attempts removed.
    static func withoutImmediateRepeats(
        words: [TranscriptWord],
        cuts: [(Int, Int)]
    ) -> [(Int, Int)] {
        guard words.count > repeatedRun else { return cuts }
        var removed = removedFlags(count: words.count, cuts: cuts)
        let kept = words.indices.filter { !removed[$0] }
        guard kept.count > repeatedRun else { return cuts }

        let tokens = kept.map { normalize(words[$0].text) }
        var seen: [[String]: Int] = [:]
        var position = 0
        while position + repeatedRun <= tokens.count {
            let run = Array(tokens[position ..< position + repeatedRun])
            defer { position += 1 }
            guard !run.contains(where: \.isEmpty) else { continue }
            guard let earlier = seen[run] else {
                seen[run] = position
                continue
            }
            seen[run] = position
            guard position - earlier <= stumbleGap else { continue }

            // Back up over whatever the two attempts also share, so what goes
            // is the whole of the first one rather than its tail.
            var first = earlier
            var second = position
            while first > 0, second > first, tokens[first - 1] == tokens[second - 1] {
                first -= 1
                second -= 1
            }
            guard second > first else { continue }

            // Never join two sentences together: a full stop inside what would
            // go means the repeat is not a stumble, it is a sentence that
            // happens to start the same way.
            let dropped = kept[first ..< second]
            guard !dropped.contains(where: { isSentenceEnd(words[$0].text) }) else { continue }

            for index in dropped { removed[index] = true }
            return withoutImmediateRepeats(words: words, cuts: ranges(from: removed))
        }
        return cuts
    }

    private static func removedFlags(count: Int, cuts: [(Int, Int)]) -> [Bool] {
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

    private static func normalize(_ text: String) -> String {
        text.lowercased().filter { $0.isLetter || $0.isNumber || $0 == "'" }
    }

    private static func isSentenceEnd(_ text: String) -> Bool {
        text.range(of: "[.!?][\"')\\]]*$", options: .regularExpression) != nil
    }
}
