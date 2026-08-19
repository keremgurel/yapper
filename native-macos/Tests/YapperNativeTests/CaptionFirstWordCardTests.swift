import Foundation
import Testing
@testable import YapperNative

/// Counted cards hold their count from the very first word.
///
/// The opening word of a take starts a breath before the clip the trimmer left,
/// so it has no position of its own and snaps to the clip's edge. That puts its
/// timeline end past the next word's start, and the "was a cut made here" test
/// read the overlap as removed recording seconds. It ended the run after one
/// word, so a project set to three words a card opened on a card saying "If".
struct CaptionFirstWordCardTests {
    private static let media = UUID()

    private static func word(
        _ text: String,
        source: ClosedRange<Double>,
        timeline: ClosedRange<Double>
    ) -> CaptionSourceWord {
        CaptionSourceWord(
            mediaID: media,
            text: text,
            sourceStart: source.lowerBound,
            sourceEnd: source.upperBound,
            timelineStart: timeline.lowerBound,
            timelineEnd: timeline.upperBound
        )
    }

    /// The real opening of a CELPIP walkthrough, timings and all. "If" runs
    /// from 1.76 to 2.00 in the recording while its clip starts at 1.86.
    private static let opening: [CaptionSourceWord] = [
        word("If", source: 1.76 ... 2.00, timeline: 0.00 ... 0.24),
        word("you're", source: 2.00 ... 2.24, timeline: 0.14 ... 0.38),
        word("studying", source: 2.24 ... 2.56, timeline: 0.38 ... 0.70),
        word("for", source: 2.56 ... 2.72, timeline: 0.70 ... 0.86),
        word("CELPIP,", source: 2.72 ... 3.44, timeline: 0.86 ... 1.58),
        word("here's", source: 3.44 ... 3.68, timeline: 1.58 ... 1.82),
    ]

    @Test("the first word never gets a card to itself")
    func firstWordSharesItsCard() {
        let cards = CaptionGenerator.captions(from: Self.opening, wordsPerCard: 3)
        #expect(cards.first?.text.split(separator: " ").count ?? 0 > 1)
        #expect(!cards.contains { $0.text.split(separator: " ").count == 1 })
    }

    @Test("a real cut still ends the run")
    func aRealCutStillBreaks() {
        // Nine seconds of recording removed between two words that now play
        // back to back.
        let across = [
            Self.word("vocabulary.", source: 5.28 ... 6.16, timeline: 3.42 ... 4.30),
            Self.word("Navigate", source: 14.635 ... 15.035, timeline: 4.04 ... 4.44),
            Self.word("to", source: 15.035 ... 15.275, timeline: 4.44 ... 4.68),
        ]
        let cards = CaptionGenerator.captions(from: across, wordsPerCard: 3)
        #expect(cards.map { $0.text } == ["vocabulary.", "Navigate to"])
    }
}
