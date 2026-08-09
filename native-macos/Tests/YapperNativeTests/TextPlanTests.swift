import Foundation
import Testing
@testable import YapperNative

/// Words drawn over the video, matched back onto the words that were said.
struct TextPlanTests {
    private let mediaID = UUID()

    /// "44% of users came from search, and 12% from socials."
    private var words: [TranscriptWord] {
        let spoken = ["44%", "of", "users", "came", "from", "search", "and", "12%", "from", "socials"]
        return spoken.enumerated().map { index, text in
            TranscriptWord(
                mediaID: mediaID,
                text: text,
                start: Double(index) * 0.5,
                end: Double(index) * 0.5 + 0.4
            )
        }
    }

    @Test func textIsPlacedOnTheWordsItQuotes() {
        let spans = TextPlan.spans(
            words: words,
            requests: [TextRequest(text: "44%", quote: "44% of users came from search")]
        )
        #expect(spans.count == 1)
        #expect(spans[0].text == "44%")
        #expect(spans[0].firstWord == 0)
        #expect(spans[0].lastWord == 5)
        // No cue, so it arrives with the first word of its quote.
        #expect(spans[0].anchorWord == 0)
        #expect(spans[0].hold == .quote)
    }

    @Test func aCueLandsTheTextOnItsOwnWord() {
        let spans = TextPlan.spans(
            words: words,
            requests: [
                TextRequest(text: "12%", quote: "and 12% from socials", cue: "12%"),
            ]
        )
        #expect(spans[0].anchorWord == 7)
    }

    /// The whole point of the feature: one request per time it is said.
    @Test func everyMentionGetsItsOwnText() {
        let spans = TextPlan.spans(
            words: words,
            requests: [
                TextRequest(text: "44%", quote: "44% of users"),
                TextRequest(text: "12%", quote: "and 12% from socials"),
            ]
        )
        #expect(spans.map(\.text) == ["44%", "12%"])
    }

    @Test func textIsReturnedInTheOrderItIsSpoken() {
        let spans = TextPlan.spans(
            words: words,
            requests: [
                TextRequest(text: "12%", quote: "and 12% from socials"),
                TextRequest(text: "44%", quote: "44% of users"),
            ]
        )
        #expect(spans.map(\.text) == ["44%", "12%"])
    }

    @Test func aQuoteTheSpeakerNeverSaidIsDropped() {
        let spans = TextPlan.spans(
            words: words,
            requests: [TextRequest(text: "90%", quote: "ninety percent of our revenue")]
        )
        #expect(spans.isEmpty)
    }

    @Test func aLabelLongEnoughToBeACaptionIsNotALabel() {
        let long = String(repeating: "word ", count: 30)
        let spans = TextPlan.spans(
            words: words,
            requests: [TextRequest(text: long, quote: "44% of users")]
        )
        #expect(spans.isEmpty)
    }

    // MARK: - How long it stays

    @Test func theHoldIsReadFromWhateverTheModelSaid() {
        #expect(TextHold(nil) == .quote)
        #expect(TextHold("next") == .next)
        #expect(TextHold("END") == .end)
        #expect(TextHold("  ") == .quote)
        #expect(TextHold("and 12% from socials") == .untilQuote("and 12% from socials"))
    }

    @Test func holdingUntilSomeWordsFindsThoseWords() {
        let spans = TextPlan.spans(
            words: words,
            requests: [
                TextRequest(
                    text: "44%",
                    quote: "44% of users",
                    until: "from socials"
                ),
            ]
        )
        #expect(spans[0].holdUntilWord == 9)
    }

    /// A hold on words nobody said falls back to the sentence it came from,
    /// rather than holding forever on a quote that is not there.
    @Test func holdingUntilWordsThatWereNeverSaidFallsBack() {
        let spans = TextPlan.spans(
            words: words,
            requests: [
                TextRequest(text: "44%", quote: "44% of users", until: "the whole funnel"),
            ]
        )
        #expect(spans[0].holdUntilWord == nil)
    }
}

/// Where labels sit when several are up at once.
struct TextStackLayoutTests {
    @Test func aSingleLabelSitsOnTheFirstRow() {
        let rows = TextStackLayout.rows(for: [.init(start: 0, end: 2)])
        #expect(rows == [TextStackLayout.firstRow])
    }

    @Test func labelsHeldTogetherStackDownwards() {
        // Three, each arriving before the last has left, which is what "hold
        // them all until the end" produces.
        let rows = TextStackLayout.rows(for: [
            .init(start: 0, end: 9),
            .init(start: 2, end: 9),
            .init(start: 4, end: 9),
        ])
        #expect(rows == [
            TextStackLayout.y(forRow: 0),
            TextStackLayout.y(forRow: 1),
            TextStackLayout.y(forRow: 2),
        ])
        #expect(rows[0] < rows[1] && rows[1] < rows[2])
    }

    @Test func labelsThatReplaceEachOtherShareOneRow() {
        let rows = TextStackLayout.rows(for: [
            .init(start: 0, end: 2),
            .init(start: 2, end: 4),
            .init(start: 4, end: 6),
        ])
        #expect(rows == [TextStackLayout.firstRow, TextStackLayout.firstRow, TextStackLayout.firstRow])
    }

    @Test func aRowIsReusedAsSoonAsItIsFree() {
        let rows = TextStackLayout.rows(for: [
            .init(start: 0, end: 10),
            .init(start: 1, end: 2),
            // The second has gone by now, so this takes its row back.
            .init(start: 3, end: 5),
        ])
        #expect(rows[1] == rows[2])
        #expect(rows[0] != rows[1])
    }

    @Test func aStackNeverSlidesDownIntoTheCaptions() {
        let many = (0 ..< 12).map { TextStackLayout.Span(start: Double($0), end: 100) }
        let rows = TextStackLayout.rows(for: many)
        #expect(rows.allSatisfy { $0 <= TextStackLayout.lastRow })
    }
}
