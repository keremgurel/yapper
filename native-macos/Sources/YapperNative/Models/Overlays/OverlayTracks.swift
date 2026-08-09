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

    /// Two spans share at least one instant. Touching edges do not.
    static func collide(
        _ start: Double,
        _ duration: Double,
        _ otherStart: Double,
        _ otherDuration: Double
    ) -> Bool {
        start < otherStart + otherDuration && otherStart < start + duration
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
