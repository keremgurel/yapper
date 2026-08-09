import Foundation
import Testing
@testable import YapperNative

struct OverlayPlanTests {
    private let mediaID = UUID()

    private func words(_ text: String) -> [TranscriptWord] {
        text.split(separator: " ").enumerated().map { index, token in
            TranscriptWord(
                mediaID: mediaID,
                text: String(token),
                start: Double(index) * 0.4,
                end: Double(index) * 0.4 + 0.35
            )
        }
    }

    @Test func aFencedChattyReplyStillYieldsItsPlacements() {
        let reply = """
        Sure! Here you go:
        ```json
        {"placements":[{"file":"hook.png","quote":"what this video is about","reason":"names the topic"}]}
        ```
        """
        let placements = OverlayPlan.parsePlacements(reply)
        #expect(placements.count == 1)
        #expect(placements[0].file == "hook.png")
        #expect(placements[0].reason == "names the topic")
    }

    @Test func entriesWithoutAFileOrAQuoteAreDropped() {
        let reply = #"{"placements":[{"file":"a.png"},{"quote":"hello"},{"file":"b.png","quote":"hi"}]}"#
        #expect(OverlayPlan.parsePlacements(reply).map(\.file) == ["b.png"])
    }

    @Test func nonsenseParsesToNothingRatherThanThrowing() {
        #expect(OverlayPlan.parsePlacements("I could not do that").isEmpty)
        #expect(OverlayPlan.parsePlacements("{not json}").isEmpty)
    }

    @Test func aPlacementCarriesTheBoxTheModelAskedFor() {
        let reply = #"""
        {"placements":[{"file":"a.png","quote":"hi there","x":0.06,"y":0.05,"width":0.55}]}
        """#
        #expect(
            OverlayPlan.parsePlacements(reply).first?.box
                == ProposedOverlayBox(x: 0.06, y: 0.05, width: 0.55)
        )
    }

    /// The words are the hard part. A model that fumbles the arithmetic should
    /// still land its cutaway on the right sentence, in the default card.
    @Test func aBadBoxCostsTheBoxAndNotThePlacement() {
        func box(_ fields: String) -> ProposedOverlayBox? {
            OverlayPlan.parsePlacements(
                #"{"placements":[{"file":"a.png","quote":"hi there",\#(fields)}]}"#
            ).first?.box
        }
        // Nothing said at all.
        #expect(box(#""reason":"why""#) == nil)
        // Half a box is not a box.
        #expect(box(#""width":0.5"#) == nil)
        // Pixels, not fractions.
        #expect(box(#""x":120,"y":40,"width":600"#) == nil)
        // A width of zero would be an overlay nobody can see.
        #expect(box(#""x":0.1,"y":0.1,"width":0"#) == nil)
        // Strings where numbers belong.
        #expect(box(#""x":"left","y":"top","width":"half""#) == nil)
        // Every one of those still kept the placement itself.
        #expect(
            OverlayPlan
                .parsePlacements(#"{"placements":[{"file":"a.png","quote":"hi there"}]}"#)
                .map(\.file) == ["a.png"]
        )
    }

    @Test func anExactQuoteIsFoundWhereItWasSaid() {
        let transcript = words("today I want to show you the editor I built last month")
        let span = OverlayPlan.quoteSpan(in: transcript, quote: "show you the editor")
        #expect(span == 4 ... 7)
    }

    @Test func aQuoteWithATidiedWordIsStillFound() {
        let transcript = words("and then I just kind of gave up on it")
        // The model dropped "just" and fixed the punctuation.
        let span = OverlayPlan.quoteSpan(in: transcript, quote: "then I really kind of gave")
        #expect(span == 1 ... 6)
    }

    @Test func aQuoteNobodySaidIsRefused() {
        let transcript = words("this is a completely different sentence entirely")
        #expect(OverlayPlan.quoteSpan(in: transcript, quote: "buy my course today please") == nil)
    }

    @Test func onlyQuotesTheTranscriptBacksBecomeSpans() {
        let transcript = words("the first point is about pricing and the second is about speed")
        let spans = OverlayPlan.spans(
            words: transcript,
            placements: [
                .init(file: "pricing.png", quote: "is about pricing", reason: "pricing"),
                .init(file: "unknown.png", quote: "is about speed", reason: "not in the bin"),
                .init(file: "speed.png", quote: "words never spoken here at all", reason: nil),
            ],
            knownFiles: ["pricing.png", "speed.png"]
        )
        #expect(spans.map(\.file) == ["pricing.png"])
        #expect(spans[0].firstWord == 3)
        #expect(spans[0].lastWord == 5)
    }

    @Test func aSpanTooShortToSeeIsDropped() {
        let transcript = [
            TranscriptWord(mediaID: mediaID, text: "yes", start: 1, end: 1.2),
        ]
        let spans = OverlayPlan.spans(
            words: transcript,
            placements: [.init(file: "a.png", quote: "yes", reason: nil)],
            knownFiles: ["a.png"]
        )
        #expect(spans.isEmpty)
    }

    @Test func twoPlacementsCannotClaimTheSameWords() {
        let transcript = words("the point I keep making about pricing is the important one")
        let spans = OverlayPlan.spans(
            words: transcript,
            placements: [
                .init(file: "a.png", quote: "I keep making about pricing", reason: nil),
                .init(file: "b.png", quote: "keep making about pricing is", reason: nil),
            ],
            knownFiles: ["a.png", "b.png"]
        )
        #expect(spans.map(\.file) == ["a.png"])
    }

    /// A row of icons is cued off one sentence on purpose, so sharing a quote
    /// is the normal case there rather than the sign of a confused model.
    @Test func oneRowMaySharedAQuoteAndDifferOnlyInItsCue() {
        let transcript = words("you can find me on Instagram and TikTok every day")
        let quote = "find me on Instagram and TikTok every day"
        let spans = OverlayPlan.spans(
            words: transcript,
            placements: [
                .init(file: "ig.png", quote: quote, reason: nil, cue: "Instagram", group: "icons"),
                .init(file: "tt.png", quote: quote, reason: nil, cue: "TikTok", group: "icons"),
            ],
            knownFiles: ["ig.png", "tt.png"]
        )
        #expect(spans.map(\.file) == ["ig.png", "tt.png"])
        #expect(spans[0].anchorWord == 5)
        #expect(spans[1].anchorWord == 7)
        // They still cover the same sentence, so they leave together.
        #expect(spans[0].lastWord == spans[1].lastWord)
        #expect(spans.allSatisfy { $0.group == "icons" })
    }

    /// "Show all three icons when I say socials" is three overlays on one
    /// syllable. The row lays them out side by side, so being simultaneous is
    /// not a problem to solve here.
    @Test func oneRowMayPutSeveralIconsOnOneWord() {
        let transcript = words("everything is linked on my socials down below")
        let quote = "linked on my socials down below"
        let placement = { (file: String) in
            OverlayPlacement(
                file: file,
                quote: quote,
                reason: nil,
                cue: "socials",
                group: "icons"
            )
        }
        let spans = OverlayPlan.spans(
            words: transcript,
            placements: [placement("ig.png"), placement("tt.png"), placement("yt.png")],
            knownFiles: ["ig.png", "tt.png", "yt.png"]
        )
        #expect(spans.map(\.file) == ["ig.png", "tt.png", "yt.png"])
        // All on the same word, and all leaving together.
        #expect(Set(spans.map(\.anchorWord)) == [5])
        #expect(Set(spans.map(\.lastWord)).count == 1)
    }

    /// Without a group there is nothing deciding where two simultaneous
    /// overlays go, so a model claiming one moment twice is still refused.
    @Test func twoUngroupedPlacementsCannotShareAMoment() {
        let transcript = words("everything is linked on my socials down below")
        let quote = "linked on my socials down below"
        let spans = OverlayPlan.spans(
            words: transcript,
            placements: [
                .init(file: "ig.png", quote: quote, reason: nil, cue: "socials"),
                .init(file: "tt.png", quote: quote, reason: nil, cue: "socials"),
            ],
            knownFiles: ["ig.png", "tt.png"]
        )
        #expect(spans.map(\.file) == ["ig.png"])
    }

    /// A cue the sentence does not contain is not worth losing a placement
    /// over. The quote already found the right moment.
    @Test func aCueThatIsNotThereFallsBackToTheStartOfTheQuote() {
        let transcript = words("the point I keep making about pricing is important")
        let spans = OverlayPlan.spans(
            words: transcript,
            placements: [
                .init(file: "a.png", quote: "keep making about pricing", reason: nil, cue: "YouTube"),
            ],
            knownFiles: ["a.png"]
        )
        #expect(spans.count == 1)
        #expect(spans[0].anchorWord == spans[0].firstWord)
    }

    @Test func aPlacementCarriesItsCueGroupAndSound() {
        let reply = #"""
        {"placements":[{"file":"ig.png","quote":"on Instagram and TikTok",
        "cue":"Instagram","group":"icons","sound":"pop"}]}
        """#
        let placement = OverlayPlan.parsePlacements(reply).first
        #expect(placement?.cue == "Instagram")
        #expect(placement?.group == "icons")
        #expect(placement?.sound == "pop")
    }

    @Test func aSpanThatJumpsBetweenRecordingsIsDropped() {
        let other = UUID()
        let transcript = [
            TranscriptWord(mediaID: mediaID, text: "one", start: 0, end: 0.5),
            TranscriptWord(mediaID: mediaID, text: "two", start: 0.5, end: 1),
            TranscriptWord(mediaID: other, text: "three", start: 0, end: 0.5),
        ]
        let spans = OverlayPlan.spans(
            words: transcript,
            placements: [.init(file: "a.png", quote: "one two three", reason: nil)],
            knownFiles: ["a.png"]
        )
        #expect(spans.isEmpty)
    }

    @Test func mentionsMatchTheLibraryEvenWhenNamesContainSpaces() {
        let names = ["day 06 hook.png", "day 06 hook.png.bak", "cta.png"]
        let mentioned = OverlayPlan.mentionedNames(
            in: "put @day 06 hook.png at the top and @cta.png at the end",
            names: names
        )
        #expect(mentioned == ["day 06 hook.png", "cta.png"])
    }

    @Test func anInstructionThatNamesNothingMentionsNothing() {
        #expect(
            OverlayPlan.mentionedNames(
                in: "place these wherever they fit",
                names: ["a.png", "b.png"]
            ).isEmpty
        )
    }
}
