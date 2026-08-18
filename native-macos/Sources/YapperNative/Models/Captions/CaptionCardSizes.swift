import Foundation

/// How a run of words is divided into counted cards.
///
/// A cut, a media change or a real pause ends a run, and what is left over
/// rarely divides by the count the creator asked for. Filling cards to the brim
/// and letting the remainder fall out left orphans: at three words a card, a
/// real edit came out with nineteen cards holding a single word.
///
/// So the whole run is divided at once, choosing the breaks that read best
/// among the divisions that keep the count. Full cards are what was asked for
/// and cost nothing; a short card costs something, a stray single word costs a
/// great deal, and a card ending on a word that belongs to the next phrase —
/// "the", "to", "and" — costs enough to move the break but not enough to break
/// the promise.
enum CaptionCardSizes {
    /// A card that is not full at all, whatever it is short by. Flat, and
    /// large, because the count is the promise: three full cards and a short
    /// one beats four cards that are each a word light.
    static let notFull = 4
    /// Each word a short card is missing, on top of that.
    static let shortfall = 1
    /// Another card than the run strictly needs.
    static let extraCard = 6
    /// A card ending on a word that points at whatever comes next. Small on
    /// purpose: it decides between divisions that are otherwise equal and it
    /// never buys its way out of the count.
    static let clingingEnd = 1
    /// A card ending where the speaker stopped, which is where a reader wants
    /// to stop too. A credit rather than a cost, and equally small.
    static let sentenceEnd = -1
    /// One word alone on screen.
    static let orphan = 12

    /// The size of each card, in order, for a run of words.
    static func sizes(for words: [String], perCard: Int) -> [Int] {
        let count = words.count
        guard count > 0 else { return [] }
        guard perCard > 0 else { return [count] }
        guard count > perCard else { return [count] }

        // best[i] is the cheapest way to divide the first i words, and from[i]
        // is where the card that ends at i began.
        var best = [Int](repeating: Int.max / 4, count: count + 1)
        var from = [Int](repeating: 0, count: count + 1)
        best[0] = 0
        for end in 1 ... count {
            for start in max(0, end - perCard) ..< end {
                let cost = best[start] + card(words, start: start, end: end, perCard: perCard, run: count)
                if cost < best[end] {
                    best[end] = cost
                    from[end] = start
                }
            }
        }

        var sizes: [Int] = []
        var cursor = count
        while cursor > 0 {
            sizes.append(cursor - from[cursor])
            cursor = from[cursor]
        }
        return sizes.reversed()
    }

    private static func card(
        _ words: [String],
        start: Int,
        end: Int,
        perCard: Int,
        run: Int
    ) -> Int {
        let size = end - start
        var cost = extraCard
        if size < perCard { cost += notFull + (perCard - size) * shortfall }
        if size == 1, run > 1 { cost += orphan }
        let last = words[end - 1]
        if clings(last) { cost += clingingEnd }
        if closesSentence(last), end < run { cost += sentenceEnd }
        return cost
    }

    private static func clings(_ text: String) -> Bool {
        let word = text.lowercased().filter { $0.isLetter || $0 == "'" }
        guard !word.isEmpty else { return false }
        if text.hasSuffix(",") || text.hasSuffix(";") || text.hasSuffix(":") { return false }
        return CaptionGenerator.clingingWords.contains(word)
    }

    private static func closesSentence(_ text: String) -> Bool {
        text.hasSuffix(".") || text.hasSuffix("!") || text.hasSuffix("?")
    }
}
