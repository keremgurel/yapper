import Foundation

/// The last word on a set of cuts, read as the viewer will hear them rather
/// than as a set of takes.
///
/// The passes feed each other. Mending a seam regularly leaves two runs at the
/// same line side by side, which is what the repeat passes take out; taking a
/// repeat out can leave the run before it ending mid-sentence, which is a seam
/// again. So they run until the answer stops changing, and every round ends
/// with the seam pass, because that is the one whose result must hold.
///
/// This lives here, whole, so that what the tests run is what the editor runs.
/// It did not, once: the service returned early from a settled round while the
/// test applied one more seam pass by hand, so the test read zero seams on cuts
/// the app would have shipped with four.
enum EditFinishing {
    static let rounds = 4

    static func cuts(_ cuts: [(Int, Int)], words: [TranscriptWord]) -> [(Int, Int)] {
        var settled = SentenceSeamRepair.repaired(words: words, cuts: cuts)
        for _ in 0 ..< rounds {
            let deduped = KeptStreamRepair.withoutRepeatedSentences(words: words, cuts: settled)
            let unstuttered = KeptStreamRepair.withoutImmediateRepeats(words: words, cuts: deduped)
            let whole = SentenceSeamRepair.repaired(words: words, cuts: unstuttered)
            if same(whole, settled) { return whole }
            settled = whole
        }
        return settled
    }

    private static func same(_ a: [(Int, Int)], _ b: [(Int, Int)]) -> Bool {
        a.count == b.count && zip(a, b).allSatisfy { $0.0 == $1.0 && $0.1 == $1.1 }
    }
}
