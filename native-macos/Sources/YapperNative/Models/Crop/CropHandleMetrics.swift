import CoreGraphics

/// Shared sizing rules for crop-corner controls.
///
/// The visible grip is intentionally smaller than its interaction area. Keeping
/// the target at least 44 points wide makes corners dependable with a trackpad,
/// mouse, or touch input even when the crop itself becomes narrow.
enum CropHandleMetrics {
    static let preferredTargetSide: CGFloat = 56
    static let minimumTargetSide: CGFloat = 44
    static let gripSide: CGFloat = 18
    static let gripInset: CGFloat = 6

    static func targetLength(for cropSide: CGFloat) -> CGFloat {
        min(preferredTargetSide, max(minimumTargetSide, cropSide / 2))
    }

    /// Classifies a drag start inside a crop-local coordinate space. Corner
    /// regions deliberately extend inward; when a crop is tiny and two regions
    /// overlap, the nearest half wins predictably.
    static func corner(at point: CGPoint, cropSize: CGSize) -> CanvasResizeCorner? {
        guard cropSize.width > 0, cropSize.height > 0,
              point.x >= 0, point.y >= 0,
              point.x <= cropSize.width, point.y <= cropSize.height
        else { return nil }

        let horizontalTarget = targetLength(for: cropSize.width)
        let verticalTarget = targetLength(for: cropSize.height)
        let nearLeading = point.x <= horizontalTarget
        let nearTrailing = point.x >= cropSize.width - horizontalTarget
        let nearTop = point.y <= verticalTarget
        let nearBottom = point.y >= cropSize.height - verticalTarget

        guard (nearLeading || nearTrailing), (nearTop || nearBottom) else { return nil }

        let leading = nearLeading && (!nearTrailing || point.x <= cropSize.width / 2)
        let top = nearTop && (!nearBottom || point.y <= cropSize.height / 2)
        switch (leading, top) {
        case (true, true): return .topLeading
        case (false, true): return .topTrailing
        case (true, false): return .bottomLeading
        case (false, false): return .bottomTrailing
        }
    }
}
