import Foundation

/// The stretch of the timeline worth drawing cells for.
///
/// Every caption, text layer, overlay and sound got a cell whatever the zoom,
/// so a fully captioned edit laid out hundreds of them to show the dozen that
/// fit on screen. The tracks draw what is in this range instead.
///
/// Two details keep it from becoming its own cost. A whole viewport of margin
/// sits on each side, so a cell is already built by the time it scrolls in and
/// a drag can carry one well past the edge. And the bounds are rounded outward
/// to whole seconds, so ordinary scrolling returns the same range and leaves
/// the tracks alone.
enum TimelineVisibleRange {
    static func make(
        scrollX: Double,
        viewportWidth: Double,
        contentWidth: Double,
        duration: Double
    ) -> ClosedRange<Double> {
        let whole = 0 ... max(0, duration)
        guard
            contentWidth > 0,
            duration > 0,
            viewportWidth > 0,
            scrollX.isFinite
        else { return whole }

        let secondsPerPoint = duration / contentWidth
        let start = (scrollX - viewportWidth) * secondsPerPoint
        let end = (scrollX + 2 * viewportWidth) * secondsPerPoint
        guard start.isFinite, end.isFinite else { return whole }

        let lower = max(0, start.rounded(.down))
        let upper = min(duration, end.rounded(.up))
        guard lower < upper else { return whole }
        return lower ... upper
    }
}

extension ClosedRange where Bound == Double {
    /// Whether an item spanning `start ..< start + duration` shows up here. A
    /// zero-length item still counts: it is a mark on the timeline, not a gap.
    func showsItem(start: Double, duration: Double) -> Bool {
        let end = start + Swift.max(0, duration)
        return end >= lowerBound && start <= upperBound
    }

    /// The part of an item worth painting, expressed from zero to one.
    ///
    /// Timeline cells keep their full frame so time and pointer geometry stay
    /// exact, but expensive contents such as thumbnails and waveform bars only
    /// need to exist where this range intersects them.
    func visibleFraction(start: Double, duration: Double) -> ClosedRange<Double> {
        guard duration.isFinite, duration > 0 else { return 0 ... 0 }
        let itemEnd = start + duration
        let visibleStart = Swift.max(start, lowerBound)
        let visibleEnd = Swift.min(itemEnd, upperBound)
        guard visibleEnd > visibleStart else { return 0 ... 0 }
        return Swift.min(1, Swift.max(0, (visibleStart - start) / duration))
            ... Swift.min(1, Swift.max(0, (visibleEnd - start) / duration))
    }
}
