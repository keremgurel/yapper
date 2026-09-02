import Foundation

/// Which transcript words each caption card is currently covering.
///
/// A card is anchored to a stretch of the recording, not to a fixed string, so
/// what it says is whatever survives inside that stretch. Cutting a word takes
/// it off the card; restoring it puts it back. Only a card the creator has typed
/// into stops listening, because at that point the words on screen are theirs.
struct CaptionWordIndex: Sendable {
    private let wordsByCaption: [UUID: [TranscriptWord]]

    /// - Parameter keptWords: the transcript words still in the cut, in edited
    ///   timeline order.
    init(captions: [ProjectCaption], keptWords: [TranscriptWord]) {
        // Cards are laid out per recording, and one card's tail padding can
        // reach past the start of the next. Assigning each word to the latest
        // card that still contains it keeps a word from appearing twice.
        //
        // A card the creator has typed into or retimed by hand is left out of
        // this entirely: it says what they told it to say, so it has no use for
        // words — and a card stretched across its neighbour would otherwise
        // take every word the neighbour was living on and leave it blank.
        var assigned: [UUID: [TranscriptWord]] = [:]
        var claimedWordIDs: Set<UUID> = []
        let keptByID = Dictionary(uniqueKeysWithValues: keptWords.map { ($0.id, $0) })
        for caption in captions where !caption.isTextEdited {
            guard let wordIDs = caption.wordIDs, !wordIDs.isEmpty else { continue }
            let words = wordIDs.compactMap { keptByID[$0] }
            if !words.isEmpty { assigned[caption.id] = words }
            claimedWordIDs.formUnion(words.map(\.id))
        }

        var sortedByMedia: [UUID: [ProjectCaption]] = [:]
        for caption in captions where !caption.isTextEdited && caption.wordIDs == nil {
            sortedByMedia[caption.mediaID, default: []].append(caption)
        }
        for (mediaID, group) in sortedByMedia {
            sortedByMedia[mediaID] = group.sorted { $0.sourceStart < $1.sourceStart }
        }

        for word in keptWords where !claimedWordIDs.contains(word.id) {
            guard
                let candidates = sortedByMedia[word.mediaID],
                let caption = CaptionWordIndex.caption(covering: word.midpoint, in: candidates)
            else { continue }
            assigned[caption.id, default: []].append(word)
        }
        // Preserve edited-timeline order. Source time can run backwards when a
        // creator places a later piece of a recording before an earlier one.
        wordsByCaption = assigned
    }

    func words(for captionID: UUID) -> [TranscriptWord] {
        wordsByCaption[captionID] ?? []
    }

    /// What a card says right now: what was typed if it was typed, otherwise the
    /// words that are still in the cut.
    func text(for caption: ProjectCaption) -> String {
        guard !caption.isTextEdited else { return caption.text }
        return words(for: caption.id)
            .map { $0.text.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .joined(separator: " ")
    }

    /// The stretch of recording a card still needs, once cut words at either end
    /// have stopped counting. Never wider than the card was given: a card that
    /// lost its first word starts at the word that replaced it.
    func sourceRange(for caption: ProjectCaption) -> (start: Double, end: Double)? {
        guard !caption.isTextEdited else { return (caption.sourceStart, caption.sourceEnd) }
        let words = words(for: caption.id)
        guard let first = words.first, let last = words.last else { return nil }
        let start = max(caption.sourceStart, first.start - CaptionGenerator.leadSeconds)
        let end = min(caption.sourceEnd, last.end + CaptionGenerator.tailSeconds)
        guard end > start else { return (caption.sourceStart, caption.sourceEnd) }
        return (start, end)
    }

    /// The last card that still covers this point. Cards are sorted, so the
    /// search is a walk back from the first one starting after it.
    private static func caption(
        covering midpoint: Double,
        in sorted: [ProjectCaption]
    ) -> ProjectCaption? {
        var low = 0
        var high = sorted.count
        while low < high {
            let middle = (low + high) / 2
            if sorted[middle].sourceStart <= midpoint {
                low = middle + 1
            } else {
                high = middle
            }
        }
        var index = low - 1
        while index >= 0 {
            let caption = sorted[index]
            if caption.sourceEnd >= midpoint { return caption }
            // Ranges can be ragged, so one card ending early does not mean the
            // one before it cannot reach.
            index -= 1
        }
        return nil
    }
}
