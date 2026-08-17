import Foundation
import Testing
@testable import YapperNative

/// The one thing a finished edit must never do: play half of one attempt at a
/// sentence followed by the other half of another.
///
/// The passes feed each other, so this checks them together on cuts of the
/// shape the cleaner really returns, rather than each pass in isolation.
@Suite
struct EditFinishingInvariantTests {
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

    /// Exactly what the editor runs, not a copy of it.
    private func finished(_ words: [TranscriptWord], cuts: [(Int, Int)]) -> [Bool] {
        let final = EditFinishing.cuts(cuts, words: words)
        var removed = Array(repeating: false, count: words.count)
        for cut in final where cut.0 <= cut.1 {
            for index in max(0, cut.0) ... min(words.count - 1, cut.1) { removed[index] = true }
        }
        return removed
    }

    private func seams(_ words: [TranscriptWord], _ removed: [Bool]) -> Int {
        words.indices.dropLast().count { index in
            !removed[index] && removed[index + 1]
                && !SentenceSeamRepair.endsSentence(words[index].text)
        }
    }

    /// Three runs at one line, cut the way the cleaner cuts them: a clause from
    /// here, a clause from there.
    @Test("No cut leaves a sentence half said, whatever the cleaner returned")
    func neverLeavesASeam() {
        let source = words(
            "Alright. Another freestyle update on my app. "
                + "Alright. Off the cuff updates on my app. "
                + "Alright. Back with another off the cuff update on my app. "
                + "Six people purchased premium this week. "
                + "That puts it at 17 payments total including renewables since launch. "
                + "That puts us in 17 payments total including renewals since launch."
        )
        // Every cut that starts or ends inside a sentence, which is the whole
        // family of ways this went wrong.
        for start in stride(from: 2, to: source.count - 6, by: 3) {
            for length in [4, 7, 11] {
                let end = min(source.count - 2, start + length)
                guard start <= end else { continue }
                let removed = finished(source, cuts: [(start, end)])
                #expect(
                    seams(source, removed) == 0,
                    "cut \(start)...\(end) left a sentence half said"
                )
            }
        }
    }

    @Test("An edit with nothing wrong with it is left alone")
    func leavesAGoodEditAlone() {
        let source = words("One two three. Four five six. Seven eight nine. Ten eleven twelve.")
        let removed = finished(source, cuts: [(3, 5)])
        let heard = source.indices.filter { !removed[$0] }.map { source[$0].text }
        #expect(heard.joined(separator: " ") == "One two three. Seven eight nine. Ten eleven twelve.")
    }
}
