import Foundation

/// How the teleprompter looks and reads, tuned live. The presets match the
/// web recorder's so a creator moving between the two finds the same steps.
struct TeleprompterSettings: Equatable {
    var fontScale: Double = 1
    var heightFraction: Double = 0.44
    var shade: Double = 0.75
    var leadInSeconds: Int = 3
    var wordsPerMinute: Int = 130

    struct Option<Value: Hashable & Sendable>: Hashable, Sendable {
        let value: Value
        let label: String
    }

    static let fontScales: [Option<Double>] = [
        .init(value: 0.85, label: "S"), .init(value: 1, label: "M"),
        .init(value: 1.2, label: "L"), .init(value: 1.45, label: "XL"),
    ]
    static let heights: [Option<Double>] = [
        .init(value: 0.32, label: "Short"), .init(value: 0.44, label: "Medium"), .init(value: 0.60, label: "Tall"),
    ]
    static let shades: [Option<Double>] = [
        .init(value: 0.5, label: "Low"), .init(value: 0.75, label: "Medium"), .init(value: 0.95, label: "High"),
    ]
    static let leadIns: [Option<Int>] = [0, 2, 3, 5].map { .init(value: $0, label: "\($0)s") }
    static let speeds: [Option<Int>] = [100, 130, 160, 200].map { .init(value: $0, label: "\($0)") }

    /// Base prompt size in points before the text size multiplier.
    static let baseFontSize: Double = 26
    /// Rough points of scroll per word at the base size, tuned by feel like
    /// the web's; the creator adjusts speed live anyway.
    static let pointsPerWord: Double = 9

    /// Scroll speed in points per second. Bigger text is taller, so it
    /// scrolls faster to hold the same reading pace.
    var pointsPerSecond: Double {
        Double(wordsPerMinute) / 60 * Self.pointsPerWord * fontScale
    }
}
