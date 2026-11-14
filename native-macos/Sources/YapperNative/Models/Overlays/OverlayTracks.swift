import Foundation

/// The lanes overlays sit in.
///
/// Every overlay names its track: 0 is the lane directly above the speaker, and
/// a higher lane draws over a lower one. Tracks are implicit — they exist
/// because something is on them — so nothing here stores a track, it only reads
/// one off the overlays.
enum OverlayTracks {
    /// The highest lane in use, or -1 when there are no overlays.
    static func top(_ overlays: [ProjectOverlay]) -> Int {
        overlays.reduce(-1) { max($0, $1.lane) }
    }

    /// How many lanes the timeline has to draw. Always at least one, so there
    /// is somewhere to drop the first overlay.
    static func count(_ overlays: [ProjectOverlay]) -> Int {
        max(1, top(overlays) + 1)
    }

    static func on(_ track: Int, in overlays: [ProjectOverlay]) -> [ProjectOverlay] {
        overlays.filter { $0.lane == track }
    }

    /// Overlaps shorter than this are two overlays butting end to end. A
    /// start of 21.71588571110309 plus 2.16 lands 5 µs past a neighbour at
    /// 23.8758807111031, and refusing that refused exactly the cut the creator
    /// asked for: one overlay handing straight over to the next.
    static let touchTolerance = 0.001

    /// Two spans share more than a moment. Touching edges do not, and nor do
    /// edges that miss touching by float drift.
    static func collide(
        _ start: Double,
        _ duration: Double,
        _ otherStart: Double,
        _ otherDuration: Double
    ) -> Bool {
        min(start + duration, otherStart + otherDuration) - max(start, otherStart) > touchTolerance
    }

    /// The overlay with its edges pulled onto any neighbour on its lane that
    /// they overrun by drift, so butting overlays hand over on the same frame
    /// instead of sharing a few microseconds.
    static func butted(_ overlay: ProjectOverlay, against others: [ProjectOverlay]) -> ProjectOverlay {
        var fitted = overlay
        for other in others where other.id != overlay.id && other.lane == overlay.lane {
            let end = fitted.timelineStart + fitted.duration
            let otherEnd = other.timelineStart + other.duration
            if other.timelineStart > fitted.timelineStart, end > other.timelineStart,
               end - other.timelineStart <= touchTolerance {
                fitted.duration = other.timelineStart - fitted.timelineStart
            }
            if otherEnd < end, fitted.timelineStart < otherEnd, otherEnd - fitted.timelineStart <= touchTolerance {
                let shift = otherEnd - fitted.timelineStart
                fitted.timelineStart = otherEnd
                fitted.duration -= shift
            }
        }
        return fitted
    }

    /// Something other than `id` is already on that lane at that time. A lane
    /// holds any number of overlays as long as they do not overlap.
    static func isOccupied(
        _ track: Int,
        by span: (id: UUID, start: Double, duration: Double),
        in overlays: [ProjectOverlay]
    ) -> Bool {
        overlays.contains { overlay in
            overlay.lane == track
                && overlay.id != span.id
                && collide(span.start, span.duration, overlay.timelineStart, overlay.duration)
        }
    }

    /// The lowest lane that can take a span, adding one on top if every lane
    /// below is busy.
    static func firstFreeTrack(
        for span: (id: UUID, start: Double, duration: Double),
        in overlays: [ProjectOverlay]
    ) -> Int {
        var track = 0
        while isOccupied(track, by: span, in: overlays) { track += 1 }
        return track
    }

    /// Closes the stack up after a lane has been deleted, so nothing is left
    /// hanging above an empty gap. Emptying a lane by moving its last overlay
    /// away deliberately leaves the lane behind.
    static func compacted(_ overlays: [ProjectOverlay]) -> [ProjectOverlay] {
        let used = Set(overlays.map(\.lane)).sorted()
        let renumbered = Dictionary(
            uniqueKeysWithValues: used.enumerated().map { ($0.element, $0.offset) }
        )
        return overlays.map { overlay in
            var moved = overlay
            moved.track = renumbered[overlay.lane] ?? 0
            return moved
        }
    }

    /// Every overlay, back to front: a higher lane draws over a lower one, and
    /// within a lane the one added later wins.
    static func backToFront(_ overlays: [ProjectOverlay]) -> [ProjectOverlay] {
        overlays.enumerated()
            .sorted { left, right in
                if left.element.lane != right.element.lane {
                    return left.element.lane < right.element.lane
                }
                return left.offset < right.offset
            }
            .map(\.element)
    }
}
