import Foundation

/// Cards for words that came back after the cards were made.
///
/// Cards are built over the words that are in the cut, so a word that was cut
/// when captions were generated has no card anywhere near it. Restoring it in
/// the transcript put the line back in the video with nothing on screen under
/// it, and the only way to caption it was Regenerate, which throws away every
/// text edit and every restyling in the project to fix one line.
///
/// So the stretches nothing covers get cards of their own, grouped by the same
/// generator as the rest, and every existing card is left exactly as it was.
enum CaptionGapFill {
    /// How far a new card stays clear of the cards either side of it. A word
    /// belongs to the last card whose range contains it, so a new card allowed
    /// to overlap the one before it would take that card's closing words away.
    static let clearance = 0.01
    /// Shorter than this and there was no real room between the neighbours.
    static let shortestCard = 0.05

    static func captions(
        coveringGapsIn captions: [ProjectCaption],
        words: [CaptionSourceWord],
        wordsPerCard: Int
    ) -> [ProjectCaption] {
        guard !captions.isEmpty, !words.isEmpty else { return [] }
        var byMedia: [UUID: [ProjectCaption]] = [:]
        for caption in captions { byMedia[caption.mediaID, default: []].append(caption) }

        var fresh: [ProjectCaption] = []
        var uncovered: [CaptionSourceWord] = []

        func flush() {
            guard !uncovered.isEmpty else { return }
            for caption in CaptionGenerator.captions(from: uncovered, wordsPerCard: wordsPerCard) {
                if let fitted = fitted(caption, among: byMedia[caption.mediaID] ?? []) {
                    fresh.append(fitted)
                }
            }
            uncovered.removeAll(keepingCapacity: true)
        }

        for word in words {
            // A run of uncovered words ends at the first word that has a card,
            // which keeps a new card from being built across one already there.
            if isCovered(word, by: byMedia[word.mediaID] ?? []) {
                flush()
            } else {
                uncovered.append(word)
            }
        }
        flush()
        return fresh
    }

    private static func isCovered(_ word: CaptionSourceWord, by captions: [ProjectCaption]) -> Bool {
        if let id = word.id, captions.contains(where: { $0.wordIDs?.contains(id) == true }) {
            return true
        }
        let midpoint = (word.sourceStart + word.sourceEnd) / 2
        return captions.contains { $0.sourceStart <= midpoint && $0.sourceEnd >= midpoint }
    }

    /// Trims a new card back into the gap it was built for. Returns nil when a
    /// card already sits over the middle of it, or when the gap turns out to be
    /// too small to be worth a card.
    private static func fitted(
        _ caption: ProjectCaption,
        among neighbours: [ProjectCaption]
    ) -> ProjectCaption? {
        let middle = (caption.sourceStart + caption.sourceEnd) / 2
        var fitted = caption
        for neighbour in neighbours {
            if neighbour.sourceEnd <= middle {
                fitted.sourceStart = max(fitted.sourceStart, neighbour.sourceEnd + clearance)
            } else if neighbour.sourceStart <= middle {
                return nil
            } else {
                fitted.sourceEnd = min(fitted.sourceEnd, neighbour.sourceStart - clearance)
            }
        }
        guard fitted.sourceEnd - fitted.sourceStart >= shortestCard else { return nil }
        return fitted
    }
}
