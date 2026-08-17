import Foundation

/// Nothing the creator said once may vanish from the edit entirely.
///
/// Removing retakes means keeping one run at a line and dropping the rest. It
/// does not mean dropping all of them. On a real recording every one of the
/// four runs at "And we're at 324 users, which sounds absolutely insane to me."
/// was cut, so a number the whole video was about never got said.
///
/// This reads the sentences that were removed, asks of each whether anything
/// surviving says the same thing, and puts one run back when nothing does. The
/// run it picks is the one that stumbles least, which is the same choice the
/// repeat passes make when they keep one of two.
enum LostLineRepair {
    /// Shorter than this and a sentence is a filler the cleaner is entitled to
    /// drop: "Alright.", "So yeah.", "Okay."
    static let worthKeeping = 6

    static func restoringLostLines(
        words: [TranscriptWord],
        cuts: [(Int, Int)]
    ) -> [(Int, Int)] {
        guard !words.isEmpty else { return cuts }
        var removed = flags(count: words.count, cuts: cuts)
        let sentences = sentences(of: words)
        let keptTokens = sentences
            .filter { sentence in sentence.count { !removed[$0] } > sentence.count / 2 }
            .map { tokens($0, in: words) }

        // Removed sentences grouped by the line they are a run at.
        var groups: [[[Int]]] = []
        for sentence in sentences {
            guard sentence.allSatisfy({ removed[$0] }) else { continue }
            let spoken = tokens(sentence, in: words)
            guard spoken.count >= worthKeeping else { continue }
            if keptTokens.contains(where: { KeptStreamRepair.isSameLine(spoken, $0) }) { continue }
            if let index = groups.firstIndex(where: { group in
                group.contains { KeptStreamRepair.isSameLine(tokens($0, in: words), spoken) }
            }) {
                groups[index].append(sentence)
            } else {
                groups.append([sentence])
            }
        }

        for group in groups {
            // The cleanest run at it, and the last of those when they tie.
            guard let best = group.min(by: { left, right in
                let stumblesLeft = KeptStreamRepair.stumbles(tokens(left, in: words))
                let stumblesRight = KeptStreamRepair.stumbles(tokens(right, in: words))
                if stumblesLeft != stumblesRight { return stumblesLeft < stumblesRight }
                return (left.last ?? 0) > (right.last ?? 0)
            }) else { continue }
            for index in best { removed[index] = false }
        }
        return ranges(from: removed)
    }

    private static func sentences(of words: [TranscriptWord]) -> [[Int]] {
        var result: [[Int]] = []
        var current: [Int] = []
        for index in words.indices {
            current.append(index)
            if SentenceSeamRepair.endsSentence(words[index].text) {
                result.append(current)
                current = []
            }
        }
        if !current.isEmpty { result.append(current) }
        return result
    }

    private static func tokens(_ sentence: [Int], in words: [TranscriptWord]) -> [String] {
        sentence
            .map { words[$0].text.lowercased().filter { $0.isLetter || $0.isNumber || $0 == "'" } }
            .filter { !$0.isEmpty }
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
}
