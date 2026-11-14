import Foundation

/// Where one file is already used on the timeline: how many times on the main
/// track, how many times as an overlay, and which parts of it those are.
struct MediaUsage: Equatable, Sendable {
    /// A used part of the file, in the file's own seconds.
    struct Part: Equatable, Sendable {
        let start: Double
        let end: Double
    }

    var mainTrackCount = 0
    var overlayCount = 0
    var parts: [Part] = []

    static let none = MediaUsage()

    var isPlaced: Bool { mainTrackCount + overlayCount > 0 }

    /// Said the way the row says it: "On the main track ×3 and as an overlay".
    /// Nil for a file that is not on the timeline.
    var summary: String? {
        let main = mainTrackCount > 0 ? "On the main track" + Self.times(mainTrackCount) : nil
        let overlay = overlayCount > 0 ? "an overlay" + Self.times(overlayCount) : nil
        switch (main, overlay) {
        case let (main?, overlay?): return "\(main) and as \(overlay)"
        case let (main?, nil): return main
        case let (nil, overlay?): return "Used as \(overlay)"
        case (nil, nil): return nil
        }
    }

    private static func times(_ count: Int) -> String {
        count > 1 ? " ×\(count)" : ""
    }

    /// Every file's usage, worked out in one pass over the timeline.
    static func byMedia(clips: [TimelineClip], overlays: [ProjectOverlay]) -> [UUID: MediaUsage] {
        var usage: [UUID: MediaUsage] = [:]
        for clip in clips {
            usage[clip.mediaID, default: .none].mainTrackCount += 1
            usage[clip.mediaID, default: .none].add(clip.sourceStart, clip.sourceEnd)
        }
        for overlay in overlays {
            usage[overlay.mediaID, default: .none].overlayCount += 1
            usage[overlay.mediaID, default: .none].add(
                overlay.sourceStart,
                overlay.sourceStart + overlay.sourceDuration
            )
        }
        return usage
    }

    private mutating func add(_ start: Double, _ end: Double) {
        guard end > start else { return }
        parts.append(Part(start: max(0, start), end: end))
    }
}
