import Foundation

/// Measurements the timeline viewport needs to turn a zoom scale into a content
/// width and a legal horizontal scroll offset.
///
/// A value type so every scroll and zoom decision is computed from one snapshot
/// of the layout instead of reading half-updated view state.
struct TimelineViewportLayout: Equatable {
    var duration: Double
    /// Width of the scrollable area, excluding the fixed track-header column.
    var viewportWidth: Double
    /// Floor applied to short projects so a two second clip is not a hairline.
    var minimumContentWidth: Double
    var leadingInset: Double
    var trailingInset: Double

    func contentWidth(at pointsPerSecond: Double) -> Double {
        max(minimumContentWidth, duration * pointsPerSecond)
    }

    func documentWidth(contentWidth: Double) -> Double {
        leadingInset + contentWidth + trailingInset
    }

    func maximumScrollX(contentWidth: Double) -> Double {
        max(0, documentWidth(contentWidth: contentWidth) - viewportWidth)
    }

    func clampedScrollX(_ scrollX: Double, contentWidth: Double) -> Double {
        min(maximumScrollX(contentWidth: contentWidth), max(0, scrollX))
    }
}
