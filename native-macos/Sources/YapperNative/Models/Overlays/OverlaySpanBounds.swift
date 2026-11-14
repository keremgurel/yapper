import Foundation

/// How long an overlay may run, given where it starts on the timeline and in
/// its media.
///
/// A length a hair past the end is the creator's rounding, not a request to
/// run past it: "20.67 seconds" for a 620-frame clip is 20.667 s, and failing
/// it rolled back a six-overlay plan. Anything within `tolerance` of an end is
/// trimmed to that end; anything further is still refused.
enum OverlaySpanBounds {
    /// A little over one frame at 24 fps.
    static let tolerance = 0.05

    /// The duration that fits, or nil when it overshoots by more than the
    /// tolerance or leaves less than a tenth of a second.
    ///
    /// - Parameters:
    ///   - mediaDuration: The source's length; nil for a still, which can run
    ///     as long as it likes.
    ///   - rate: Source seconds played per timeline second.
    static func fitted(
        duration: Double,
        start: Double,
        sourceStart: Double,
        mediaDuration: Double?,
        rate: Double = 1,
        timelineDuration: Double
    ) -> Double? {
        var fitted = duration
        let timelineRoom = timelineDuration - start
        if fitted > timelineRoom {
            guard fitted - timelineRoom <= tolerance else { return nil }
            fitted = timelineRoom
        }
        if let mediaDuration {
            let room = (mediaDuration - sourceStart) / max(rate, 0.000001)
            if fitted > room {
                guard fitted - room <= tolerance else { return nil }
                fitted = room
            }
        }
        return fitted >= 0.1 ? fitted : nil
    }
}

extension OverlaySpanBounds {
    /// Why a length was refused, naming the file and how much of it there is,
    /// so one overlay in a plan of six says which one and by how much.
    static func refusal(media: ProjectMedia, sourceStart: Double) -> String {
        guard !media.isImage else { return "Keep \(media.name) inside the timeline." }
        let room = max(0, media.duration - sourceStart)
        return "\(media.name) has \(String(format: "%.2f", room)) s from that point, so the overlay can be at most that long and has to stay inside the timeline."
    }
}
