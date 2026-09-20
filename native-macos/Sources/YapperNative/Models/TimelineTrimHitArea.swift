import CoreGraphics

/// Selected cells reserve at least 70% of their width for moving. Trim targets
/// stay inside the cell and shrink with short clips instead of overlapping.
enum TimelineTrimHitArea {
    static let minimumDragDistance: CGFloat = 3

    static func width(for cellWidth: CGFloat) -> CGFloat {
        guard cellWidth.isFinite, cellWidth > 0 else { return 0 }
        return min(6, cellWidth * 0.15)
    }
}
