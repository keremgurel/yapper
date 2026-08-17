import Foundation

/// Which marks the timestamps strip actually has to draw.
///
/// The strip is as wide as the zoomed timeline, and it used to draw every tick
/// and lay out every timestamp across the whole of it. Zoomed in on a two
/// minute edit that is a few thousand strokes and several hundred pieces of
/// text, of which about twenty are on screen, redrawn every time anything
/// moves. Sampled while a creator scrolled and zoomed, this was the single
/// hottest thing in the app.
enum TimelineRulerTicks {
    struct Tick: Equatable {
        let time: Double
        /// Long marks carry a timestamp; short ones are just rhythm.
        let isMajor: Bool
    }

    /// The stretch of the strip worth drawing, in points.
    ///
    /// A page either side of the viewport, so an ordinary scroll runs through
    /// already-drawn marks and the strip is only asked for more when the
    /// creator crosses into a page it has not drawn. Scrolling that redrew on
    /// every frame would trade one kind of slow for another.
    static func window(scrollX: Double, viewportWidth: Double) -> ClosedRange<Double> {
        let page = max(1, viewportWidth)
        let start = max(0, (floor(max(0, scrollX) / page) - 1) * page)
        return start ... (start + 3 * page)
    }

    /// - Parameters:
    ///   - width: the whole strip, which is what maps a time to a point.
    ///   - visible: the stretch of it to draw, in points.
    static func ticks(
        duration: Double,
        width: Double,
        visible: ClosedRange<Double>
    ) -> [Tick] {
        guard duration > 0, width > 0 else { return [] }
        let approximateStep = max(1, duration / max(2, floor(width / 100)))
        let majorStep = niceStep(approximateStep)
        let minorStep = majorStep / 5
        guard minorStep > 0 else { return [] }

        let secondsPerPoint = duration / width
        let from = max(0, visible.lowerBound * secondsPerPoint)
        let to = min(duration, visible.upperBound * secondsPerPoint)
        guard to >= from else { return [] }

        // Counted from zero whatever is on screen, so which marks are long does
        // not change as the strip scrolls.
        var index = max(0, Int(floor(from / minorStep)))
        var result: [Tick] = []
        while true {
            let time = Double(index) * minorStep
            if time > to + 0.001 || time > duration + 0.001 { break }
            result.append(Tick(time: time, isMajor: index.isMultiple(of: 5)))
            index += 1
        }
        return result
    }

    static func niceStep(_ raw: Double) -> Double {
        let power = pow(10, floor(log10(raw)))
        let normalized = raw / power
        let nice: Double = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10
        return nice * power
    }
}
