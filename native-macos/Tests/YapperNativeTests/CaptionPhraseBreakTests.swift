import Foundation
import Testing
@testable import YapperNative

/// Counted cards keep their literal count. Phrase-aware grouping belongs to
/// Auto; choosing a number makes where every full card breaks predictable.
@Suite
struct CaptionPhraseBreakTests {
    private let mediaID = UUID()

    private func words(_ text: String) -> [CaptionSourceWord] {
        text.split(separator: " ").enumerated().map { index, token in
            CaptionSourceWord(
                mediaID: mediaID,
                text: String(token),
                sourceStart: Double(index) * 0.3,
                sourceEnd: Double(index) * 0.3 + 0.28,
                timelineStart: Double(index) * 0.3,
                timelineEnd: Double(index) * 0.3 + 0.28
            )
        }
    }

    private func cards(_ text: String, perCard: Int = 3) -> [String] {
        CaptionGenerator.captions(from: words(text), wordsPerCard: perCard).map(\.text)
    }

    @Test("Grammar never shifts a counted boundary")
    func grammarDoesNotShiftTheCount() {
        let text = "Month one is next week and I'll do the full cost versus revenue then."
        #expect(cards(text) == [
            "Month one is",
            "next week and",
            "I'll do the",
            "full cost versus",
            "revenue then.",
        ])
    }

    @Test("Cards hold the size that was asked for")
    func keepsTheCount() {
        let text = "Month one is next week and I'll do the full cost versus revenue then."
        let sizes = cards(text).map { $0.split(separator: " ").count }
        // Every card is full except the final remainder.
        #expect(sizes.dropLast().allSatisfy { $0 == 3 })
        #expect(sizes.last == 2)
        // Nothing is dropped or duplicated on the way.
        #expect(cards(text).joined(separator: " ") == text)
    }

    @Test("Sentence punctuation does not override a counted boundary")
    func sentencePunctuationDoesNotMoveTheBoundary() {
        let cards = cards("It works out well. We are at 324 users now.")
        #expect(cards == ["It works out", "well. We are", "at 324 users", "now."])
    }

    @Test("Auto is untouched")
    func autoStillGroupsByPhrase() {
        let text = "Month one is next week and I'll do the full cost versus revenue then."
        let auto = cards(text, perCard: CaptionWordsPerCard.auto)
        #expect(!auto.isEmpty)
        #expect(auto.joined(separator: " ") == text)
    }
}
