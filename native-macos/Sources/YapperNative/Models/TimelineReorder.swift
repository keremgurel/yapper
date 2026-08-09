import Foundation

/// Where a dragged block of clips will land on the video track, and how wide a
/// gap the remaining clips must open to show it.
struct TimelineReorderPlan: Equatable {
    /// Index into the clips that are *not* being dragged.
    let insertionIndex: Int
    /// Combined duration of the dragged block, i.e. the size of the gap.
    let blockDuration: Double
}

/// The video track is magnetic: clips butt up against each other and their
/// order is the edit. Dropping a block therefore picks an index rather than a
/// time, and the drag preview and the commit have to agree on which index, or
/// the clip lands somewhere other than the gap you were shown.
enum TimelineReorderGeometry {
    /// The block settles after every clip whose midpoint it has passed, which
    /// is what makes neighbours swap one at a time instead of all at once.
    static func insertionIndex(
        targetStart: Double,
        remainingDurations: [Double]
    ) -> Int {
        var cursor = 0.0
        for (index, duration) in remainingDurations.enumerated() {
            if targetStart < cursor + duration / 2 { return index }
            cursor += duration
        }
        return remainingDurations.count
    }

    /// Clamps the dragged block's start to the span the remaining clips leave.
    static func targetStart(
        blockStart: Double,
        delta: Double,
        blockDuration: Double,
        projectDuration: Double
    ) -> Double {
        min(max(0, projectDuration - blockDuration), max(0, blockStart + delta))
    }
}
