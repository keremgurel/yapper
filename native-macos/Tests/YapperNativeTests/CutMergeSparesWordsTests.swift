import Foundation
import Testing
@testable import YapperNative

/// Tidying up nearly-touching cuts must not eat the word between them.
///
/// Cuts a few hundredths of a second apart are joined so the timeline is not
/// littered with splices, and a short word is a few hundredths of a second
/// long. Measured on a real edit, this took a hundred spoken words out of a
/// finished cut that had already been checked, and left the sentence around
/// each of them half said.
@Suite
struct CutMergeSparesWordsTests {
    private let mediaID = UUID()

    /// "…from Bing. And two of our buyers…" with a very short "And".
    private func words() -> [TranscriptWord] {
        [
            TranscriptWord(mediaID: mediaID, text: "Bing.", start: 0.0, end: 0.40),
            TranscriptWord(mediaID: mediaID, text: "And", start: 0.44, end: 0.48),
            TranscriptWord(mediaID: mediaID, text: "two", start: 0.52, end: 0.80),
            TranscriptWord(mediaID: mediaID, text: "buyers.", start: 0.80, end: 1.20),
        ]
    }

    @Test("A short word between two cuts is not swallowed by joining them")
    func keepsTheShortWord() async throws {
        let service = AIEditService()
        let source = words()
        // Cut the first word and the last two, leaving "And" alone in a gap of
        // eight hundredths of a second.
        let ranges = try await service.autoEditRanges(
            words: source,
            duration: 1.4,
            aiCuts: [(0, 0), (2, 3)]
        )
        let midpoint = (source[1].start + source[1].end) / 2
        #expect(!ranges.contains { $0.0 <= midpoint && midpoint <= $0.1 })
    }

    @Test("Cuts with nothing spoken between them still join")
    func stillTidiesEmptyGaps() async throws {
        let service = AIEditService()
        let source = [
            TranscriptWord(mediaID: mediaID, text: "One.", start: 0.0, end: 0.40),
            TranscriptWord(mediaID: mediaID, text: "Two.", start: 3.00, end: 3.40),
        ]
        let ranges = try await service.autoEditRanges(
            words: source,
            duration: 3.8,
            aiCuts: [(0, 0)]
        )
        // The head cut and the pause after it are one cut, not two.
        #expect(ranges.count <= 2)
    }
}
