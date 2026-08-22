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
    /// A shared ending has to be at least this many words: two sentences can
    /// both finish "this week" without being the same sentence.
    static let sameEndingWords = 4
    /// And has to be most of the shorter one.
    static let sameEnding = 0.6
    /// How much of the shorter sentence has to appear in the longer one for it
    /// to be an earlier run at the same line.
    static let contained = 0.7
    /// Below this a sentence is too small for containment to mean anything.
    static let containedWords = 6
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
                // Usually the speaker's last run is the one they meant, but not
                // when they said it cleanly and then fell over it: "…one refund
                // that we had in July." followed by "And 200 and and $295 of
                // the processing fees…". The run that stumbles less wins, and
                // the later one only wins ties.
                let dropEarlier = stumbles(earlier) >= stumbles(later)
                for index in dropEarlier ? sentences[first] : sentences[second] {
                    removed[index] = true
                }
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
        // A speaker who restarts a line usually lands on the same finish. "It's
        // crazy because you think, who uses Bing anymore?" and "Like, who uses
        // Bing anymore?" share nothing but their ending, and it is the ending
        // that gives them away.
        let ending = zip(a.reversed(), b.reversed()).prefix { $0 == $1 }.count
        if ending >= sameEndingWords,
           Double(ending) / Double(min(a.count, b.count)) >= sameEnding
        {
            return true
        }
        if sharedWords(a, b) >= sameSentence { return true }
        // One attempt said inside another: "That puts it at 17 payments total
        // including renewables since launch." against "That puts us in 17
        // payments total including renewals since launch, which is $325…".
        // Almost every word of the shorter is in the longer, in the same order,
        // which is what a second run at a line looks like when the speaker
        // carried on further the second time.
        let shorter = min(a.count, b.count)
        guard shorter >= containedWords else { return false }
        // Compared by their openings, because the transcriber does not hear the
        // same word the same way twice: "renewables" one run and "renewals" the
        // next, "purchase" and "purchased".
        let roughA = a.map(rough)
        let roughB = b.map(rough)
        return shared(roughA, roughB) >= Double(shorter) * contained
    }

    private static func rough(_ token: String) -> String {
        String(token.prefix(5))
    }

    /// How much a run stumbles over itself.
    ///
    /// Counting a word said twice in a row catches "and 200 and and $295 of
    /// the…" but not "but I also broke the product but I also broke the
    /// product twice this week", which is the same phrase started twice and
    /// reads far worse. Both count here: a word repeated on the spot, and a
    /// pair of words the run comes back to.
    static func stumbles(_ tokens: [String]) -> Int {
        let doubled = zip(tokens, tokens.dropFirst()).count { $0 == $1 }
        guard tokens.count > 2 else { return doubled }
        var seen: Set<[String]> = []
        var restarts = 0
        for index in 0 ..< (tokens.count - 1) {
            let pair = [tokens[index], tokens[index + 1]]
            if seen.contains(pair) { restarts += 1 } else { seen.insert(pair) }
        }
        return doubled + restarts
    }

    /// Words the two have in common, counting each one once.
    private static func shared(_ a: [String], _ b: [String]) -> Double {
        var counts: [String: Int] = [:]
        for token in a { counts[token, default: 0] += 1 }
        var total = 0.0
        for token in b where (counts[token] ?? 0) > 0 {
            counts[token]! -= 1
            total += 1
        }
        return total
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

    /// A word or two said twice in a row, with no breath in between.
    ///
    /// The repeat passes above read three words at a time, because at that
    /// length a repetition is meaningful. Below it they see nothing, and what
    /// survived into a finished edit was: "you can save 15% on on a a monthly
    /// or weekly weekly plan. Plan", and "here you'll here you'll be able to",
    /// and "as well as well as a better phrasing section".
    ///
    /// The tell is that there is no gap. Every one of those was spoken with the
    /// copies touching or overlapping, while the same words said twice for a
    /// reason have a beat between them. So the first copy goes only when the
    /// second follows immediately.
    static let doubledGap = 0.35
    /// Said twice on purpose often enough to leave alone.
    static let saidTwiceForEffect: Set<String> = ["very", "really", "no", "yes", "so"]

    static func withoutDoubledPhrases(
        words: [TranscriptWord],
        cuts: [(Int, Int)]
    ) -> [(Int, Int)] {
        var removed = removedFlags(count: words.count, cuts: cuts)
        // Longer first: "here you'll here you'll" is one doubled phrase, not two
        // unrelated words that happen to repeat.
        for length in [2, 1] {
            var changed = true
            while changed {
                changed = false
                let kept = words.indices.filter { !removed[$0] }
                guard kept.count >= length * 2 else { continue }
                for start in 0 ... (kept.count - length * 2) {
                    let first = Array(kept[start ..< start + length])
                    let second = Array(kept[start + length ..< start + length * 2])
                    let firstTokens = first.map { normalize(words[$0].text) }
                    let secondTokens = second.map { normalize(words[$0].text) }
                    guard firstTokens == secondTokens,
                          !firstTokens.contains(where: \.isEmpty),
                          !(length == 1 && saidTwiceForEffect.contains(firstTokens[0])),
                          words[second[0]].start - words[first[length - 1]].end < doubledGap
                    else { continue }
                    for index in first { removed[index] = true }
                    changed = true
                    break
                }
            }
        }
        return ranges(from: removed)
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
