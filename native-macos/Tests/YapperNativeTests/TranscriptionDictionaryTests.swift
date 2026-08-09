import Foundation
import Testing
@testable import YapperNative

struct TranscriptionDictionaryTests {
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

    @Test func spellingsAreComparedWithoutCaseOrPunctuation() {
        #expect(TranscriptionDictionary.key("CELPIP!") == TranscriptionDictionary.key("celpip"))
        #expect(TranscriptionDictionary.key("  Yapper's ") == "yappers")
        #expect(TranscriptionDictionary.key("!!!").isEmpty)
    }

    @Test func aliasesAreTidiedAndDeduped() {
        let entry = DictionaryEntry(
            term: "  CELPIP  ",
            aliases: ["cell pip", "Cell   Pip", "celpip", ""]
        )
        #expect(entry.term == "CELPIP")
        #expect(entry.aliases == ["cell pip", "celpip"])
    }

    @Test func aHeardSpellingIsReplacedWithTheCreatorsOwn() {
        let entry = DictionaryEntry(term: "CELPIP", aliases: ["celpip"])
        let corrected = TranscriptionDictionary.applied(
            to: words("i passed my celpip exam"),
            entries: [entry]
        )
        #expect(corrected.map(\.text) == ["i", "passed", "my", "CELPIP", "exam"])
    }

    @Test func theCanonicalSpellingCorrectsItsOwnCasing() {
        // Nothing is aliased here: the term itself is the pattern, so a
        // lowercase transcript still picks up the creator's capitals.
        let corrected = TranscriptionDictionary.applied(
            to: words("try yapper today"),
            entries: [DictionaryEntry(term: "Yapper")]
        )
        #expect(corrected.map(\.text) == ["try", "Yapper", "today"])
    }

    @Test func aMultiWordAliasWithTheSameCountKeepsEveryWordsTiming() {
        let heard = words("visit new york city now")
        let corrected = TranscriptionDictionary.applied(
            to: heard,
            entries: [DictionaryEntry(term: "New York City", aliases: ["new york city"])]
        )
        #expect(corrected.count == heard.count)
        #expect(corrected.map(\.text) == ["visit", "New", "York", "City", "now"])
        #expect(corrected[1].start == heard[1].start)
        #expect(corrected[3].end == heard[3].end)
    }

    @Test func aShorterSpellingCollapsesOntoTheStretchItReplaced() {
        let heard = words("the cell pip exam")
        let corrected = TranscriptionDictionary.applied(
            to: heard,
            entries: [DictionaryEntry(term: "CELPIP", aliases: ["cell pip"])]
        )
        #expect(corrected.map(\.text) == ["the", "CELPIP", "exam"])
        // It covers exactly the words it replaced, rather than inventing times.
        #expect(corrected[1].start == heard[1].start)
        #expect(corrected[1].end == heard[2].end)
    }

    @Test func punctuationAtTheEndOfAWordSurvivesTheCorrection() {
        let corrected = TranscriptionDictionary.applied(
            to: words("i use yapper."),
            entries: [DictionaryEntry(term: "Yapper")]
        )
        #expect(corrected.map(\.text) == ["i", "use", "Yapper."])
    }

    @Test func theLongestSpellingWins() {
        let corrected = TranscriptionDictionary.applied(
            to: words("welcome to new york city"),
            entries: [
                DictionaryEntry(term: "New York", aliases: ["new york"]),
                DictionaryEntry(term: "New York City", aliases: ["new york city"]),
            ]
        )
        #expect(corrected.map(\.text) == ["welcome", "to", "New", "York", "City"])
    }

    @Test func nothingChangesWithoutADictionary() {
        let heard = words("just the words as heard")
        #expect(TranscriptionDictionary.applied(to: heard, entries: []) == heard)
    }

    @Test func keytermsAreDedupedAndBounded() {
        let terms = TranscriptionDictionary.keyterms([
            DictionaryEntry(term: "CELPIP"),
            DictionaryEntry(term: "celpip!"),
            DictionaryEntry(term: "Yapper"),
        ])
        #expect(terms == ["CELPIP", "Yapper"])
    }

    @Test func aOneWordFixIsWorthRemembering() {
        let correction = TranscriptionDictionary.correction(
            before: "i passed my celpip exam",
            after: "i passed my CELPIP exam"
        )
        #expect(correction?.heard == "celpip")
        #expect(correction?.term == "CELPIP")
    }

    @Test func aRewriteIsNot() {
        #expect(
            TranscriptionDictionary.correction(
                before: "one two three",
                after: "completely different words entirely"
            ) == nil
        )
        // Two words changed: which one was the point is anyone's guess.
        #expect(
            TranscriptionDictionary.correction(
                before: "one two three",
                after: "one four five"
            ) == nil
        )
        // A word added.
        #expect(
            TranscriptionDictionary.correction(
                before: "one two",
                after: "one two three"
            ) == nil
        )
    }

    @Test func punctuationOnlyEditsAreNotCorrections() {
        #expect(
            TranscriptionDictionary.correction(
                before: "hello there",
                after: "hello there!"
            ) == nil
        )
    }
}
