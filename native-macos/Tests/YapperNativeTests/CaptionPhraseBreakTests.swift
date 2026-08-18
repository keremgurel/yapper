import Foundation
import Testing
@testable import YapperNative

/// Counted cards keep their count. Where the words allow a choice, they break
/// where a reader would.
///
/// The count is the promise: picking three words a card and getting a one, a
/// two and a four is not the look anybody chose. So a run of words is divided
/// into full cards wherever it divides, and the reading rules — do not end on
/// "the", do end where the speaker stopped — decide between divisions that
/// cost the same rather than buying their way out of the count.
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

    @Test("Cards avoid ending on a word that belongs to the next one")
    func rarelyEndsMidPhrase() {
        let text = "Month one is next week and I'll do the full cost versus revenue then."
        let ends = cards(text).dropLast().count { card in
            let last = card.split(separator: " ").last.map(String.init) ?? ""
            let bare = last.lowercased().filter { $0.isLetter || $0 == "'" }
            return CaptionGenerator.clingingWords.contains(bare)
        }
        // Not none: at three words a card this line cannot be divided into
        // full cards without one of them landing on "and" or "the", and the
        // count comes first. Most of them still read.
        #expect(ends <= 1)
    }

    @Test("Cards hold the size that was asked for")
    func keepsTheCount() {
        let text = "Month one is next week and I'll do the full cost versus revenue then."
        let sizes = cards(text).map { $0.split(separator: " ").count }
        // Never more than asked for, never a word on its own, and most of them
        // exactly the count.
        #expect(sizes.allSatisfy { $0 >= 2 && $0 <= 3 })
        #expect(sizes.count { $0 == 3 } >= sizes.count - 1)
        // Nothing is dropped or duplicated on the way.
        #expect(cards(text).joined(separator: " ") == text)
    }

    /// A full stop is where a reader wants to stop, so a card ends there when
    /// the division allows it. It is not a break in its own right any more: a
    /// counted card that stopped at every sentence came out at one and two
    /// words far more often than at the count that was asked for.
    @Test("A sentence ends a card when the count allows it")
    func sentencesEndCardsWhenTheyCan() {
        let cards = cards("It works out well. We are at 324 users now.")
        // The full stop lands at the end of a card rather than in the middle of
        // one, which is the whole of what the sentence rule is worth now.
        #expect(cards.contains { $0.hasSuffix("well.") })
        #expect(cards.allSatisfy { $0.split(separator: " ").count <= 3 })
    }

    @Test("Auto is untouched")
    func autoStillGroupsByPhrase() {
        let text = "Month one is next week and I'll do the full cost versus revenue then."
        let auto = cards(text, perCard: CaptionWordsPerCard.auto)
        #expect(!auto.isEmpty)
        #expect(auto.joined(separator: " ") == text)
    }
}
