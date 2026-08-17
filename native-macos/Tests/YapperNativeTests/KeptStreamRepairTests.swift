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

/// Whole runs at a line, not just a stumble inside one.
@Suite
struct RepeatedSentenceTests {
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
        for cut in cuts where cut.0 <= cut.1 {
            for index in cut.0 ... cut.1 { removed[index] = true }
        }
        return words.indices.filter { !removed[$0] }.map { words[$0].text }.joined(separator: " ")
    }

    /// From a real recording: both runs at the line survived the edit, forty
    /// words apart, so the video said the whole thing twice.
    @Test("The take the speaker settled on is the one that stays")
    func keepsTheLaterRun() {
        let source = words(
            "And the two users that messaged me ended the conversation happy and thankful. "
                + "So it worked out very well. "
                + "And the two users that messaged me ended the conversation happy and might even get some reviews."
        )
        let repaired = KeptStreamRepair.withoutRepeatedSentences(words: source, cuts: [])
        let heard = kept(source, repaired)
        #expect(!heard.contains("happy and thankful."))
        #expect(heard.contains("might even get some reviews."))
        #expect(heard.contains("So it worked out very well."))
    }

    @Test("Two different sentences that open alike both stay")
    func keepsDistinctSentences() {
        let source = words(
            "I did it by the book with redirects and a change of address. "
                + "I did it because the old name was misleading to everybody reading it."
        )
        let repaired = KeptStreamRepair.withoutRepeatedSentences(words: source, cuts: [])
        #expect(repaired.isEmpty)
    }

    @Test("A short line said twice is left alone")
    func ignoresShortLines() {
        let source = words("Alright. Alright. So here is the thing about the numbers this week.")
        let repaired = KeptStreamRepair.withoutRepeatedSentences(words: source, cuts: [])
        #expect(repaired.isEmpty)
    }

    @Test("A callback later in the video is not a repeat")
    func ignoresDistantRepeats() {
        let source = words(
            "We are at 324 users which is absolutely insane. "
                + "Month one is next week and I will do the full cost breakdown. "
                + "Traffic held at about ninety visitors a day from Google. "
                + "Still zero pounds spent on any advertising at all. "
                + "We are at 324 users which is absolutely insane."
        )
        let repaired = KeptStreamRepair.withoutRepeatedSentences(words: source, cuts: [])
        #expect(repaired.isEmpty)
    }
}
