import Foundation

/// How often to ask a publish route again while the platform is still
/// processing. Most posts settle in the first half minute, so the early
/// checks come quickly and the later ones back off. A full run covers two
/// minutes before the page offers a status check instead.
enum PosterPublishPolling {
    static let attempts = 32

    /// The wait after a pending answer, counting pending answers from zero.
    static func wait(afterPending answer: Int) -> Duration {
        switch answer {
        case ..<5: .seconds(2)
        case ..<15: .seconds(3)
        default: .seconds(5)
        }
    }
}
