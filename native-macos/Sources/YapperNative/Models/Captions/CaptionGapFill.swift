import Foundation

/// Cards for words that came back after the cards were made.
///
/// Cards are built over the words that are in the cut, so a word that was cut
/// when captions were generated has no card anywhere near it. Restoring it in
/// the transcript put the line back in the video with nothing on screen under
/// it, and the only way to caption it was Regenerate, which throws away every
/// text edit and every restyling in the project to fix one line.
///
/// Only newly restored words need a card. Keep deliberate gaps elsewhere.
enum CaptionGapFill {
    /// How far a new card stays clear of the cards either side of it. A word
    /// belongs to the last card whose range contains it, so a new card allowed
    /// to overlap the one before it would take that card's closing words away.
    static let clearance = 0.01
    /// Shorter than this and there was no real room between the neighbours.
    static let shortestCard = 0.05

    static func filling(
        _ captions: [ProjectCaption],
        words: [CaptionSourceWord],
        wordsPerCard: Int,
        restoredIDs: Set<UUID>,
        transcript: [TranscriptWord]
    ) -> [ProjectCaption] {
        guard !words.isEmpty else { return captions }
        // Counted cards own specific words, even when their first and last
        // words are minutes apart across a cut. Only range-based or manually
        // timed cards reserve the recording seconds between their endpoints.
        let claimed = Set(captions.flatMap { $0.wordIDs ?? [] })
        let ranged = captions.filter { $0.wordIDs == nil || $0.isTextEdited }
        let byMedia = Dictionary(grouping: ranged, by: \.mediaID)

        var fresh: [ProjectCaption] = []
        var positionByWord: [UUID: Int] = [:]
        var uncovered: [CaptionSourceWord] = []

        func flush() {
            guard !uncovered.isEmpty else { return }
            for caption in CaptionGenerator.captions(from: uncovered, wordsPerCard: wordsPerCard) {
                if caption.wordIDs != nil {
                    fresh.append(caption)
                } else if let fitted = fitted(caption, among: byMedia[caption.mediaID] ?? []) {
                    fresh.append(fitted)
                }
            }
            uncovered.removeAll(keepingCapacity: true)
        }

        for (position, word) in words.enumerated() {
            if let id = word.id { positionByWord[id] = position }
            // A run of uncovered words ends at the first word that has a card,
            // which keeps a new card from being built across one already there.
            let midpoint = (word.sourceStart + word.sourceEnd) / 2
            let reserved = byMedia[word.mediaID]?.contains {
                $0.sourceStart <= midpoint && midpoint <= $0.sourceEnd
            } == true
            if let id = word.id, restoredIDs.contains(id), !claimed.contains(id), !reserved {
                uncovered.append(word)
            } else {
                flush()
            }
        }
        flush()
        let source = Dictionary(uniqueKeysWithValues: transcript.map { ($0.id, $0) })
        let kept = captions.flatMap { caption in
            splitAcrossRestoredRuns(caption, positions: positionByWord, source: source)
        }
        if fresh.isEmpty, kept.count == captions.count { return captions }
        return (kept + fresh).sorted { $0.sourceStart < $1.sourceStart }
    }

    /// When both ends of a counted card survive a restore, its words now
    /// play on opposite sides of a new cue. Give each side its own timing.
    /// Keep cut members attached so a subsequent restore still finds them.
    private static func splitAcrossRestoredRuns(
        _ caption: ProjectCaption,
        positions: [UUID: Int],
        source: [UUID: TranscriptWord]
    ) -> [ProjectCaption] {
        guard !caption.isTextEdited, !caption.locked, let ids = caption.wordIDs else { return [caption] }
        var groups: [[UUID]] = [[]]
        var previousPosition: Int?
        for id in ids {
            if let position = positions[id] {
                if let previousPosition, position != previousPosition + 1 { groups.append([]) }
                previousPosition = position
            }
            groups[groups.count - 1].append(id)
        }
        guard groups.count > 1 else { return [caption] }
        return groups.enumerated().map { index, members in
            let words = members.compactMap { source[$0] }
            var part = caption
            if index > 0 { part.id = UUID() }
            part.wordIDs = members
            part.text = words.map(\.text).joined(separator: " ")
            part.sourceStart = words.map(\.start).min() ?? caption.sourceStart
            part.sourceEnd = words.map(\.end).max() ?? caption.sourceEnd
            return part
        }
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
