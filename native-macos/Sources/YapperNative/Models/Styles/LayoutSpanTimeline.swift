import Foundation

/// Where the take's own seconds land on the timeline and back, for spans that
/// are anchored to the take. Walks the main track in order, the way the
/// composition lays it out.
extension EditorProject {
    /// Which take, and which second of it, plays at a moment of the timeline.
    func sourceLocation(atTimeline time: Double) -> (mediaID: UUID, source: Double)? {
        var cursor = 0.0
        for clip in clips {
            let end = cursor + clip.duration
            if time >= cursor, time < end {
                return (clip.mediaID, clip.sourceTime(atOffset: time - cursor))
            }
            cursor = end
        }
        return nil
    }

    /// The stretches of the timeline a span is on screen for, in order. A cut
    /// inside the span splits it; a clip that does not play its source does
    /// not show it.
    func timelineRanges(of span: LayoutSpan) -> [ClosedRange<Double>] {
        var ranges: [ClosedRange<Double>] = []
        var cursor = 0.0
        for clip in clips {
            defer { cursor += clip.duration }
            guard clip.mediaID == span.mediaID else { continue }
            let from = max(clip.sourceStart, span.sourceStart)
            let to = min(clip.sourceEnd, span.sourceEnd)
            guard to - from > 0.0001 else { continue }
            let start = cursor + clip.timelineOffset(forSource: from)
            let end = cursor + clip.timelineOffset(forSource: to)
            if let last = ranges.last, abs(last.upperBound - start) < 0.0001 {
                ranges[ranges.count - 1] = last.lowerBound ... end
            } else {
                ranges.append(start ... end)
            }
        }
        return ranges
    }

    /// From the first moment the span is on screen to the last.
    func timelineExtent(of span: LayoutSpan) -> ClosedRange<Double>? {
        let ranges = timelineRanges(of: span)
        guard let first = ranges.first, let last = ranges.last else { return nil }
        return first.lowerBound ... last.upperBound
    }

    /// Every moment a span starts or ends, for cutting the composition into
    /// stretches that each have one layout.
    var layoutSpanBoundaries: [Double] {
        resolvedLayoutSpans.flatMap { timelineRanges(of: $0).flatMap { [$0.lowerBound, $0.upperBound] } }
    }
}
