import CoreGraphics

/// What a drag starting inside the crop rectangle intends to manipulate.
enum CropDragIntent: Equatable, Sendable {
    case move
    case corner(CanvasResizeCorner)
    case edge(CropEdge)
}

/// Shared sizing and hit-testing rules for crop controls.
///
/// A single gesture owns the entire selection and asks these rules what was
/// grabbed. That avoids overlapping SwiftUI gestures and guarantees the middle
/// remains available for repositioning, even when the crop is very small.
enum CropHandleMetrics {
    static let preferredCornerTarget: CGFloat = 32
    static let preferredEdgeTarget: CGFloat = 14
    static let cornerMarkSide: CGFloat = 24
    static let edgeGripLength: CGFloat = 28
    static let edgeGripThickness: CGFloat = 6

    static func cornerTarget(for cropSide: CGFloat) -> CGFloat {
        min(preferredCornerTarget, max(0, cropSide / 3))
    }

    static func edgeTarget(for cropSide: CGFloat) -> CGFloat {
        min(preferredEdgeTarget, max(0, cropSide / 4))
    }

    /// Classifies a drag start in crop-local coordinates. Corners win over
    /// edges, edges win over movement, and neither can consume the central
    /// third that creators use to reposition the chosen part of the picture.
    static func intent(at point: CGPoint, cropSize: CGSize) -> CropDragIntent? {
        guard cropSize.width > 0, cropSize.height > 0,
              point.x >= 0, point.y >= 0,
              point.x <= cropSize.width, point.y <= cropSize.height
        else { return nil }

        let horizontalTarget = cornerTarget(for: cropSize.width)
        let verticalTarget = cornerTarget(for: cropSize.height)
        let nearLeading = point.x <= horizontalTarget
        let nearTrailing = point.x >= cropSize.width - horizontalTarget
        let nearTop = point.y <= verticalTarget
        let nearBottom = point.y >= cropSize.height - verticalTarget

        if (nearLeading || nearTrailing), (nearTop || nearBottom) {
            switch (nearLeading, nearTop) {
            case (true, true): return .corner(.topLeading)
            case (false, true): return .corner(.topTrailing)
            case (true, false): return .corner(.bottomLeading)
            case (false, false): return .corner(.bottomTrailing)
            }
        }

        let horizontalEdge = edgeTarget(for: cropSize.height)
        let verticalEdge = edgeTarget(for: cropSize.width)
        if point.y <= horizontalEdge { return .edge(.top) }
        if point.y >= cropSize.height - horizontalEdge { return .edge(.bottom) }
        if point.x <= verticalEdge { return .edge(.leading) }
        if point.x >= cropSize.width - verticalEdge { return .edge(.trailing) }
        return .move
    }
}
