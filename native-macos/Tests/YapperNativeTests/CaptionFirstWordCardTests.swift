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
        timeline: ClosedRange<Double>,
        clip: ClosedRange<Double>? = nil
    ) -> CaptionSourceWord {
        CaptionSourceWord(
            mediaID: media,
            text: text,
            sourceStart: source.lowerBound,
            sourceEnd: source.upperBound,
            timelineStart: timeline.lowerBound,
            timelineEnd: timeline.upperBound,
            clip: clip
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

    /// A cut lands inside the words either side of it, not between them.
    ///
    /// The transcriber's extents are generous and run together, so there is no
    /// gap to measure at the join: measured on a real edit, "learn." ran to
    /// 61.000 and "Choose" began at 61.000 while the video jumped 60.740 to
    /// 61.060. Stable word IDs now place the card on the edited timeline, so
    /// the selected count remains literal without anchoring it in removed
    /// footage.
    @Test("a counted card keeps its size across a cut through the words")
    func keepsItsCountAcrossACutInsideTheWords() {
        let before = 59.120 ... 60.740
        let after = 61.060 ... 62.860
        let across = [
            Self.word("wanna", source: 60.200 ... 60.440, timeline: 15.560 ... 15.800, clip: before),
            Self.word("learn.", source: 60.440 ... 61.000, timeline: 15.800 ... 16.360, clip: before),
            Self.word("Choose", source: 61.000 ... 61.400, timeline: 16.100 ... 16.500, clip: after),
            Self.word("the", source: 61.400 ... 61.560, timeline: 16.440 ... 16.600, clip: after),
        ]
        let cards = CaptionGenerator.captions(from: across, wordsPerCard: 3)

        #expect(cards.map { $0.text } == ["wanna learn. Choose", "the"])
    }

    /// The beat held at the end of a card is for the reader, not a claim on
    /// footage. A card reading "you" was lost to seventeen milliseconds of it.
    @Test("the tail never reaches past the clip and loses the card")
    func tailStaysInsideTheClip() {
        let clip = 83.045 ... 83.505
        let cards = CaptionGenerator.captions(
            from: [Self.word("you", source: 83.045 ... 83.925, timeline: 20.0 ... 20.880, clip: clip)],
            wordsPerCard: 3
        )
        let card = try! #require(cards.first)
        #expect(card.sourceEnd <= clip.upperBound)
        #expect((card.sourceStart + card.sourceEnd) / 2 <= clip.upperBound)
        #expect((card.sourceStart + card.sourceEnd) / 2 >= clip.lowerBound)
    }

    @Test("a large cut still does not change the selected count")
    func aLargeCutDoesNotChangeTheCount() {
        // Nine seconds of recording removed between two words that now play
        // back to back, so they come from different clips.
        let before = 0.0 ... 6.20
        let after = 14.60 ... 24.00
        let across = [
            Self.word("vocabulary.", source: 5.28 ... 6.16, timeline: 3.42 ... 4.30, clip: before),
            Self.word("Navigate", source: 14.635 ... 15.035, timeline: 4.04 ... 4.44, clip: after),
            Self.word("to", source: 15.035 ... 15.275, timeline: 4.44 ... 4.68, clip: after),
        ]
        let cards = CaptionGenerator.captions(from: across, wordsPerCard: 3)
        #expect(cards.map { $0.text } == ["vocabulary. Navigate to"])
    }
}
