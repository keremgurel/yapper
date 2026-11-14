import Foundation

/// The part of a file that will be added to the timeline: a start and an end
/// inside its length.
///
/// Nothing is cut from the file. The range only decides where the new clip
/// starts and stops reading it, and the clip can be stretched back out on the
/// timeline afterwards.
struct MediaTrimRange: Equatable, Sendable {
    /// The shortest piece worth adding. Below this a clip is too thin to grab.
    static let minimumLength = 0.2

    private(set) var start: Double
    private(set) var end: Double
    let duration: Double

    /// The whole file.
    init(duration: Double) {
        let safe = duration.isFinite ? max(0, duration) : 0
        self.duration = safe
        start = 0
        end = safe
    }

    var length: Double { end - start }

    /// True while nothing has been trimmed off either end.
    var isFull: Bool { start <= 0 && end >= duration }

    /// Moves the start, stopping short of the end.
    func movingStart(to time: Double) -> MediaTrimRange {
        var next = self
        next.start = min(max(0, time), max(0, end - floor))
        return next
    }

    /// Moves the end, stopping short of the start.
    func movingEnd(to time: Double) -> MediaTrimRange {
        var next = self
        next.end = max(min(duration, time), min(duration, start + floor))
        return next
    }

    /// A file shorter than the minimum is its own floor.
    private var floor: Double { min(Self.minimumLength, duration) }
}
