import Foundation

/// Keeps a card's look when the cards themselves are cut again.
///
/// Changing how many words a card holds has to rebuild every card: the
/// grouping is a property of the cards, not something laid over them. That
/// used to hand back a fresh set with the project style on all of them, so a
/// card that had been recoloured or moved lost it for a change that was only
/// ever about where the words break.
///
/// A new card takes the look of the card it came out of. Splitting one in two
/// gives both halves what the whole had; joining two into one takes the look of
/// the earlier of them, because that is the one the eye met first.
enum CaptionStyleInheritance {
    static func inherited(
        _ fresh: [ProjectCaption],
        from previous: [ProjectCaption]
    ) -> [ProjectCaption] {
        guard !previous.isEmpty else { return fresh }
        let byMedia = Dictionary(grouping: previous, by: \.mediaID)
        return fresh.map { card in
            let sameMedia = byMedia[card.mediaID] ?? []
            let wordIDs = Set(card.wordIDs ?? [])
            let sharedWordCandidates = wordIDs.isEmpty ? [] : sameMedia.filter {
                !wordIDs.isDisjoint(with: $0.wordIDs ?? [])
            }
            let candidates = (sharedWordCandidates.isEmpty ? sameMedia : sharedWordCandidates)
                .filter { $0.sourceStart < card.sourceEnd && card.sourceStart < $0.sourceEnd }
            guard let source = candidates.min(by: { $0.sourceStart < $1.sourceStart }) else {
                return card
            }
            var kept = card
            kept.overrides = source.overrides
            return kept
        }
    }
}
