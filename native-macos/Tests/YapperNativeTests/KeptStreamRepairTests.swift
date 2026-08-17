import Foundation
import Testing
@testable import YapperNative

/// What the viewer hears, checked as a sentence rather than as a set of takes.
@Suite
struct KeptStreamRepairTests {
    private let mediaID = UUID()

    private func words(_ text: String) -> [TranscriptWord] {
        text.split(separator: " ").enumerated().map { index, token in
            TranscriptWord(
                mediaID: mediaID,
                text: String(token),
                start: Double(index) * 0.3,
                end: Double(index) * 0.3 + 0.25
            )
        }
    }

    private func kept(_ words: [TranscriptWord], _ cuts: [(Int, Int)]) -> String {
        var removed = Array(repeating: false, count: words.count)
        for cut in cuts {
            for index in cut.0 ... cut.1 { removed[index] = true }
        }
        return words.indices.filter { !removed[$0] }.map { words[$0].text }.joined(separator: " ")
    }

    /// From a real recording: the cut kept the head of one attempt and the
    /// whole of the next, so the finished video said it twice.
    @Test("A line the speaker started twice is only heard once")
    func dropsTheStumble() {
        let source = words(
            "And we're currently at 324 users, we're at 324 users, which sounds absolutely insane to me."
        )
        let repaired = KeptStreamRepair.withoutImmediateRepeats(words: source, cuts: [])
        let heard = kept(source, repaired)
        #expect(heard == "And we're currently at 324 users, which sounds absolutely insane to me.")
    }

    @Test("Saying the same thing twice on purpose is left alone")
    func keepsDeliberateRepetition() {
        // Far enough apart to be two mentions rather than one stumble.
        let source = words(
            "We are at 324 users today. That is a lot of people to be honest with you, "
                + "and I still cannot believe we are at 324 users."
        )
        let repaired = KeptStreamRepair.withoutImmediateRepeats(words: source, cuts: [])
        #expect(repaired.isEmpty)
    }

    @Test("Two sentences that open the same way both survive")
    func neverJoinsSentences() {
        let source = words("I did it by the book. I did it by the book, and it worked.")
        let repaired = KeptStreamRepair.withoutImmediateRepeats(words: source, cuts: [])
        // Removing the first would swallow a full stop, so the pass declines.
        #expect(repaired.isEmpty)
    }

    @Test("Cuts already made are respected")
    func worksOnTopOfExistingCuts() {
        let source = words("rubbish rubbish And we're at 324 users, we're at 324 users, which is wild.")
        let repaired = KeptStreamRepair.withoutImmediateRepeats(words: source, cuts: [(0, 1)])
        let heard = kept(source, repaired)
        #expect(!heard.contains("rubbish"))
        #expect(heard == "And we're at 324 users, which is wild.")
    }
}
