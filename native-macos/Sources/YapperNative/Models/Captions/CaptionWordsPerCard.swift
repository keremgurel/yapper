import Foundation

/// How many spoken words each card holds. Zero means "Auto", which groups by
/// phrase (pauses, sentence ends and a character budget) instead of a count.
enum CaptionWordsPerCard {
    static let auto = 0
    static let options = [0, 1, 2, 3, 4, 5, 6, 8]
    /// Three words a card is the punchy short-form default.
    static let standard = 3

    static func label(_ value: Int) -> String {
        value == auto ? "Auto" : "\(value)"
    }

    static func normalized(_ value: Int?) -> Int {
        guard let value else { return standard }
        return options.contains(value) ? value : standard
    }
}
