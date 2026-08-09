import Foundation
import Testing

@testable import YapperNative

/// Typing `@` to name a file. The same rules the web editor uses, so a sentence
/// written in one app means the same thing in the other.
@Suite struct OverlayMentionTests {
    private let names = ["01-hook.png", "06-cta.png", "day one intro.mp4", "05-closer.png"]

    // MARK: - Finding the mention being typed

    @Test func theQueryIsWhateverFollowsTheAt() {
        let span = OverlayMention.mention(in: "Show @hoo", caret: 9)
        #expect(span?.query == "hoo")
        #expect(span?.from == 5)
    }

    /// File names have spaces in them, so a space cannot end a mention.
    @Test func aQueryCanContainSpaces() {
        let span = OverlayMention.mention(in: "Show @day one", caret: 13)
        #expect(span?.query == "day one")
    }

    @Test func anEmailAddressIsNotAMention() {
        #expect(OverlayMention.mention(in: "mail me@example.com", caret: 19) == nil)
    }

    @Test func aNewLineEndsIt() {
        #expect(OverlayMention.mention(in: "Show @hook\nand then", caret: 19) == nil)
    }

    @Test func textWithNoAtHasNoMention() {
        #expect(OverlayMention.mention(in: "Show the hook", caret: 13) == nil)
    }

    /// The caret is what decides, not the end of the text: clicking back into an
    /// earlier mention has to offer that one.
    @Test func theCaretPicksWhichMentionIsBeingTyped() {
        let value = "Show @ho and @cta"
        let span = OverlayMention.mention(in: value, caret: 8)
        #expect(span?.query == "ho")
    }

    @Test func anAtOnItsOwnOffersEverything() {
        let span = OverlayMention.mention(in: "Show @", caret: 6)
        #expect(span?.query == "")
        #expect(OverlayMention.suggestions(names: names, query: "").count == names.count)
    }

    // MARK: - Suggesting

    @Test func suggestionsMatchAnywhereInTheName() {
        #expect(OverlayMention.suggestions(names: names, query: "cta") == ["06-cta.png"])
        #expect(OverlayMention.suggestions(names: names, query: "png").count == 3)
    }

    @Test func suggestionsIgnoreCase() {
        #expect(OverlayMention.suggestions(names: names, query: "HOOK") == ["01-hook.png"])
    }

    @Test func suggestionsKeepTheLibraryOrder() {
        #expect(
            OverlayMention.suggestions(names: names, query: "-") == [
                "01-hook.png", "06-cta.png", "05-closer.png",
            ]
        )
    }

    // MARK: - Accepting

    @Test func acceptingReplacesWhatWasTypedAndLeavesASpace() {
        let value = "Show @hoo"
        let span = OverlayMention.mention(in: value, caret: 9)!

        let result = OverlayMention.applying("01-hook.png", to: value, span: span)

        #expect(result.value == "Show @01-hook.png ")
        #expect(result.caret == result.value.count)
    }

    @Test func acceptingKeepsWhateverFollowedTheCaret() {
        let value = "Show @hoo while I talk"
        let span = OverlayMention.mention(in: value, caret: 9)!

        let result = OverlayMention.applying("01-hook.png", to: value, span: span)

        #expect(result.value == "Show @01-hook.png  while I talk")
        // The caret sits after the inserted name, not at the end of the line.
        #expect(result.caret == 18)
    }

    // MARK: - Reading them back

    @Test func theFinishedSentenceNamesItsFiles() {
        let mentioned = OverlayMention.mentioned(
            in: "Show @01-hook.png then @06-cta.png",
            names: names
        )
        #expect(mentioned == ["01-hook.png", "06-cta.png"])
    }

    /// The longest name wins, so one file's name found inside another's does not
    /// claim the mention.
    @Test func aNameInsideAnotherNameDoesNotWin() {
        let library = ["intro.mp4", "intro.mp4.bak"]
        #expect(OverlayMention.mentioned(in: "Show @intro.mp4.bak", names: library) == ["intro.mp4.bak"])
    }

    @Test func namingNothingMentionsNothing() {
        #expect(OverlayMention.mentioned(in: "Show the hook somewhere", names: names).isEmpty)
    }
}

/// The loop the list got stuck in: once a name has been accepted the mention is
/// made, and offering the very file just chosen leaves no way out of the list.
@Suite struct FinishedMentionTests {
    private let names = ["01-hook.png", "05-closer.png", "day one intro.mp4"]

    @Test func acceptingASuggestionClosesTheList() {
        let value = "Show @05-closer.png "
        let span = OverlayMention.mention(in: value, caret: value.count)!
        #expect(OverlayMention.isFinished(span, names: names))
    }

    @Test func aHalfTypedNameIsNotFinished() {
        let value = "Show @05-clo"
        let span = OverlayMention.mention(in: value, caret: value.count)!
        #expect(!OverlayMention.isFinished(span, names: names))
    }

    /// Without the closing space it is still being typed, even if what is there
    /// happens to match — the creator may be about to add to it.
    @Test func anExactNameWithNoSpaceIsStillBeingTyped() {
        let value = "Show @01-hook.png"
        let span = OverlayMention.mention(in: value, caret: value.count)!
        #expect(!OverlayMention.isFinished(span, names: names))
    }

    /// Carrying on after the accepted name opens the list again, because that
    /// is a new query rather than the finished one.
    @Test func typingOnAfterAMentionOffersAgain() {
        let value = "Show @05-closer.png and @day"
        let span = OverlayMention.mention(in: value, caret: value.count)!
        #expect(!OverlayMention.isFinished(span, names: names))
        #expect(OverlayMention.suggestions(names: names, query: span.query) == ["day one intro.mp4"])
    }

    @Test func aNameWithSpacesInItStillCloses() {
        let value = "Show @day one intro.mp4 "
        let span = OverlayMention.mention(in: value, caret: value.count)!
        #expect(OverlayMention.isFinished(span, names: names))
    }
}
