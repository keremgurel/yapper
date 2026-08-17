import Foundation
import Testing
@testable import YapperNative

/// Counted cards keep their count, roughly, but stop where a reader would.
///
/// From a real edit at three words a card: "I" / "just can't prove" / "it at
/// scale." and "Month one is" / "next week, and" / "I'll do the" / "full cost
/// versus" / "revenue then." Every one of those breaks lands mid-phrase.
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

    @Test("No card ends on a word that belongs to the next one")
    func neverEndsMidPhrase() {
        let text = "Month one is next week and I'll do the full cost versus revenue then."
        for card in cards(text) {
            let last = card.split(separator: " ").last.map(String.init) ?? ""
            let bare = last.lowercased().filter { $0.isLetter || $0 == "'" }
            #expect(!CaptionGenerator.clingingWords.contains(bare), "card ends on \(last): \(card)")
        }
    }

    @Test("Cards stay about the size that was asked for")
    func keepsTheCount() {
        let text = "Month one is next week and I'll do the full cost versus revenue then."
        for card in cards(text) {
            let count = card.split(separator: " ").count
            #expect(count >= 1 && count <= 4)
        }
        // Nothing is dropped or duplicated on the way.
        #expect(cards(text).joined(separator: " ") == text)
    }

    @Test("A sentence still ends its card")
    func sentencesEndCards() {
        let cards = cards("It works. We are at 324 users now.")
        #expect(cards.first == "It works.")
    }

    @Test("Auto is untouched")
    func autoStillGroupsByPhrase() {
        let text = "Month one is next week and I'll do the full cost versus revenue then."
        let auto = cards(text, perCard: CaptionWordsPerCard.auto)
        #expect(!auto.isEmpty)
        #expect(auto.joined(separator: " ") == text)
    }
}
