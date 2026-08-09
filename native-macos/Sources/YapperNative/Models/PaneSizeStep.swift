import CoreGraphics

/// A pane's size, rounded to a step, for the things that only need to know
/// roughly how big it is.
///
/// Dragging a divider hands the panes a new size on every frame, and a great
/// deal of what reads that size does not care about the difference between
/// 719 and 720 points: a threshold, an anchor for a zoom, an ideal split. When
/// those readers are given the raw number they see sixty new values a second,
/// and each one is a state write or a rebuilt view tree that changes nothing
/// anyone can see.
///
/// Rounding to a step means they hear from a drag a handful of times instead.
/// This is the trick the transcript already used to avoid re-wrapping on every
/// frame; it is written down here so the rest of the editor can use it too.
///
/// Anything that actually draws to the edge of a pane must use the real size:
/// a step here would be a visible gap there.
enum PaneSizeStep {
    /// Coarse enough to cut the churn by an order of magnitude, fine enough
    /// that nothing measured in steps lands visibly late.
    static let standard: CGFloat = 16

    static func rounded(_ size: CGFloat, step: CGFloat = standard) -> CGFloat {
        guard step > 0 else { return size }
        return (size / step).rounded(.down) * step
    }
}
