import Foundation
import Testing
@testable import YapperNative

/// The finishing passes must not undo the cleaner's cuts.
///
/// A transcriber writes a false start and its correction as one sentence,
/// because the speaker does not pause for a full stop before restarting. Any
/// pass that reads that punctuation as an attempt boundary and reaches back to
/// it puts the false start straight back into the edit. Measured on a real
/// CELPIP walkthrough, five did, and the creator saw every one of them.
struct AIEditKeepsWhatTheModelCutTests {
    private static func transcript(_ text: String) -> [TranscriptWord] {
        let media = UUID()
        return text.split(separator: " ").enumerated().map { index, word in
            TranscriptWord(
                mediaID: media,
                text: String(word),
                start: Double(index) * 0.4,
                end: Double(index) * 0.4 + 0.3
            )
        }
    }

    private static func kept(_ cuts: [(Int, Int)], _ words: [TranscriptWord]) -> String {
        var removed = Array(repeating: false, count: words.count)
        for cut in cuts where cut.0 <= cut.1 {
            for index in max(0, cut.0) ... min(words.count - 1, cut.1) { removed[index] = true }
        }
        return words.indices.filter { !removed[$0] }.map { words[$0].text }.joined(separator: " ")
    }

    @Test("a false start inside one transcribed sentence stays cut")
    func falseStartStaysCut() {
        let words = Self.transcript(
            "Navigate to practice celpip.ca and go to practice celpip.ca and click words in the navigation bar."
        )
        // What the cleaner chose: the last complete attempt only.
        let finished = EditFinishing.aiCuts([(0, 5)], words: words)
        #expect(Self.kept(finished, words) == "to practice celpip.ca and click words in the navigation bar.")
    }

    @Test("a stutter before the kept line stays cut")
    func stutterStaysCut() {
        let words = Self.transcript(
            "Ideally, will be you can also add an can also add an example sentence."
        )
        let finished = EditFinishing.aiCuts([(0, 7)], words: words)
        #expect(Self.kept(finished, words) == "can also add an example sentence.")
    }

    @Test("no word off an abandoned attempt is glued to the front of a take")
    func noGluedLeadIn() {
        // The speaker finished the line once, fumbled it, then finished it
        // again inside a longer sentence. Keeping the finished one must not
        // drag the fumble's trailing "and go" along with it.
        let words = Self.transcript(
            "Go to practice celpip.ca and click words. "
                + "Navigate to practice celpip.ca and go to practice celpip.ca and click words in the navigation bar."
        )
        let finished = EditFinishing.aiCuts([(7, 22)], words: words)
        #expect(Self.kept(finished, words) == "Go to practice celpip.ca and click words.")
    }

    @Test("the AI path never keeps a word the cleaner cut")
    func neverWidens() {
        let words = Self.transcript(
            "Use this in practice consistently and you can get your vocabulary to a perfect level. "
                + "This and practice use this and practice consistently to be able to achieve the level you need."
        )
        let cuts = [(0, 16), (17, 22)]
        let finished = EditFinishing.aiCuts(cuts, words: words)
        var wasCut = Array(repeating: false, count: words.count)
        for cut in cuts { for index in cut.0 ... cut.1 { wasCut[index] = true } }
        var stillCut = Array(repeating: false, count: words.count)
        for cut in finished { for index in cut.0 ... cut.1 { stillCut[index] = true } }
        #expect(words.indices.allSatisfy { !wasCut[$0] || stillCut[$0] })
    }
}
