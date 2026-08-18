import Foundation

/// Where an item lands when the spot it was let go over is already taken.
///
/// A lane holds one thing at a time, and the honest answer to a drop on top of
/// something else used to be a refusal: the landing box went red and letting go
/// did nothing. But dragging a cutaway up against the one before it is the most
/// ordinary thing there is, and asking for it pixel by pixel is not editing.
///
/// So a drop that overlaps its neighbour is slid off it — flush against the end
/// of the one before, or the start of the one after, whichever is nearer to
/// where the pointer actually is. Only that far: past the reach the drop is
/// somewhere else entirely and moving it there would be a guess, so it is still
/// refused.
enum TimelineLaneNudge {
    struct Span: Equatable, Sendable {
        var start: Double
        var duration: Double

        var end: Double { start + duration }
    }

    /// Where the span should go, or nil when it does not collide at all or is
    /// too far into its neighbour to be a near miss.
    ///
    /// The pull is measured by how far the item has been pushed *into* the
    /// neighbour, not by how far it would have to travel to get out. Pushing a
    /// four second cutaway one frame into the one before it is a near miss
    /// whichever way it escapes; dropping it squarely on top is not a near miss
    /// at all, and moving it anyway would put it somewhere nobody pointed at.
    static func flush(
        _ span: Span,
        among neighbours: [Span],
        reach: Double
    ) -> (start: Double, against: Double)? {
        let hit = neighbours.filter { overlaps(span, $0) }
        guard !hit.isEmpty else { return nil }

        // How far into each neighbour it has been pushed, from either side.
        let escapes = hit.flatMap { neighbour in
            [
                (start: neighbour.end, against: neighbour.end, depth: neighbour.end - span.start),
                (
                    start: neighbour.start - span.duration,
                    against: neighbour.start,
                    depth: span.end - neighbour.start
                ),
            ]
        }
        let landing = escapes
            .filter { $0.depth <= reach && $0.start >= -0.000_1 }
            .filter { escape in
                let settled = Span(start: max(0, escape.start), duration: span.duration)
                return !neighbours.contains { overlaps(settled, $0) }
            }
            .min { $0.depth < $1.depth }

        guard let landing else { return nil }
        return (max(0, landing.start), landing.against)
    }

    /// Touching end to end is not overlapping: that is the whole point.
    private static func overlaps(_ span: Span, _ other: Span) -> Bool {
        span.start < other.end - 0.000_1 && other.start < span.end - 0.000_1
    }
}
