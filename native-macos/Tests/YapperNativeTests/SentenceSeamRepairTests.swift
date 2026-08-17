import Foundation
import Testing
@testable import YapperNative

/// What plays has to be whole sentences out of one attempt.
///
/// Both of these are from a real fifteen minute edit, where twelve of the
/// twenty-seven kept pieces ended in the middle of a sentence.
@Suite
struct SentenceSeamRepairTests {
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

    private func heard(_ words: [TranscriptWord], _ cuts: [(Int, Int)]) -> String {
        var removed = Array(repeating: false, count: words.count)
        for cut in cuts where cut.0 <= cut.1 {
            for index in max(0, cut.0) ... min(words.count - 1, cut.1) { removed[index] = true }
        }
        return words.indices.filter { !removed[$0] }.map { words[$0].text }.joined(separator: " ")
    }

    /// The seam counter this whole thing exists to drive to zero.
    private func seams(_ words: [TranscriptWord], _ cuts: [(Int, Int)]) -> Int {
        var removed = Array(repeating: false, count: words.count)
        for cut in cuts where cut.0 <= cut.1 {
            for index in max(0, cut.0) ... min(words.count - 1, cut.1) { removed[index] = true }
        }
        var count = 0
        for index in words.indices.dropLast() where !removed[index] && removed[index + 1] {
            if !SentenceSeamRepair.endsSentence(words[index].text) { count += 1 }
        }
        return count
    }

    @Test("An opening welded to another take's ending is made whole")
    func mendsTheFreestyleSeam() {
        // "Another freestyle update" was kept from one run and "on my app."
        // from a later one, so the video said them as a single sentence.
        let source = words(
            "Alright. Another freestyle update on my app. "
                + "Alright. Back with another off the cuff update on my app."
        )
        // The cut that produced the seam: keep "Alright. Another freestyle
        // update", drop the rest of that run, keep "on my app." from the next.
        let cuts = [(5, 12)]
        #expect(seams(source, cuts) == 1)
        let repaired = SentenceSeamRepair.repaired(words: source, cuts: cuts)
        #expect(seams(source, repaired) == 0)
        #expect(heard(source, repaired).contains("Another freestyle update on my app."))
    }

    @Test("A dangling half sentence is not left in front of the take that finishes it")
    func mendsThePaymentsSeam() {
        let source = words(
            "That puts it at 17 payments total including renewables since launch. "
                + "That puts us in 17 payments total including renewals since launch."
        )
        let cuts = [(4, 10)]
        #expect(seams(source, cuts) == 1)
        let repaired = SentenceSeamRepair.repaired(words: source, cuts: cuts)
        #expect(seams(source, repaired) == 0)
    }

    @Test("A cut between two whole sentences is left exactly as it is")
    func leavesCleanCutsAlone() {
        let source = words("One two three. Four five six. Seven eight nine.")
        let cuts = [(3, 5)]
        let repaired = SentenceSeamRepair.repaired(words: source, cuts: cuts)
        #expect(heard(source, repaired) == "One two three. Seven eight nine.")
    }

    @Test("A fragment whose sentence never closes is dropped rather than played")
    func dropsAnUnfinishableFragment() {
        let source = words(
            "One two three. and then it just keeps going on and on and on and on and on and on and on and on and on and on"
        )
        let cuts = [(4, 8)]
        let repaired = SentenceSeamRepair.repaired(words: source, cuts: cuts)
        #expect(seams(source, repaired) == 0)
    }
}
