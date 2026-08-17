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
