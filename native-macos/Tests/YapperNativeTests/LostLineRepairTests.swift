import Foundation
import Testing
@testable import YapperNative

/// Removing retakes means keeping one run at a line. It does not mean dropping
/// all of them.
///
/// On a real recording every one of four runs at "And we're at 324 users, which
/// sounds absolutely insane to me." was cut, so the number the whole video was
/// about was never said.
@Suite
struct LostLineRepairTests {
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

    @Test("A line every run at which was cut comes back once")
    func restoresTheLostLine() {
        let source = words(
            "That puts us in 17 payments total since launch. "
                + "And we're currently at and we're currently at 324 users, which is insane to me. "
                + "And we're at 324 users, which sounds absolutely insane to me. "
                + "Still nothing spent on advertising at all this month."
        )
        // Everything between the two surviving sentences is cut, which is what
        // happened: both runs at the line went.
        let first = 9
        let last = source.count - 10
        let repaired = EditFinishing.cuts([(first, last)], words: source)
        let text = heard(source, repaired)
        #expect(text.contains("324 users"))
        // The cleaner run, not the one that stumbles over itself.
        #expect(text.contains("sounds absolutely insane"))
        #expect(!text.contains("we're currently at and we're currently"))
    }

    @Test("A line that does survive somewhere is not put back twice")
    func leavesSurvivingLinesAlone() {
        let source = words(
            "And we're at 324 users, which is insane to me. "
                + "And we're at 324 users, which is absolutely insane to me. "
                + "Still nothing spent on advertising at all this month."
        )
        let repaired = EditFinishing.cuts([(0, 9)], words: source)
        let text = heard(source, repaired)
        #expect(text.contains("324 users"))
        // Once, not twice.
        #expect(text.components(separatedBy: "324").count - 1 == 1)
    }

    @Test("A short filler the cleaner dropped stays dropped")
    func leavesFillerDropped() {
        let source = words("Alright. So here is the thing about the numbers this week and next.")
        let repaired = EditFinishing.cuts([(0, 0)], words: source)
        #expect(!heard(source, repaired).contains("Alright."))
    }
}
