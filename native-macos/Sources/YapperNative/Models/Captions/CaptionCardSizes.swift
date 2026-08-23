import Foundation

/// How a run of words is divided into counted cards.
///
/// A counted setting is literal: choosing eight produces eight-word cards in
/// order. Only the tail of a run can be shorter. A run ends where one caption
/// cannot be represented by the model — at a cut or a change of source media.
///
/// This used to rebalance the whole run to avoid a one-word tail. That made a
/// setting such as eight produce sevens and sixes throughout the project. It
/// read nicely, but contradicted the control and made the result unpredictable.
enum CaptionCardSizes {
    /// The size of each card, in order, for a run of words.
    static func sizes(for words: [String], perCard: Int) -> [Int] {
        let count = words.count
        guard count > 0 else { return [] }
        guard perCard > 0 else { return [count] }
        var sizes: [Int] = []
        sizes.reserveCapacity(Int(ceil(Double(count) / Double(perCard))))
        var remaining = count
        while remaining > 0 {
            let size = min(perCard, remaining)
            sizes.append(size)
            remaining -= size
        }
        return sizes
    }
}
