import CoreGraphics
import Foundation

/// Which part of the panel's edge is being pulled.
///
/// Pulling a leading or top edge is two changes at once: the panel gets bigger
/// and its top-left corner moves back by the same amount, because it is placed
/// from that corner. Getting that wrong is what makes a panel appear to slide
/// away from the pointer while it grows.
enum PanelResizeEdge: CaseIterable, Sendable {
    case top
    case bottom
    case leading
    case trailing
    case topLeading
    case topTrailing
    case bottomLeading
    case bottomTrailing

    var pullsLeft: Bool {
        switch self {
        case .leading, .topLeading, .bottomLeading: true
        default: false
        }
    }

    var pullsRight: Bool {
        switch self {
        case .trailing, .topTrailing, .bottomTrailing: true
        default: false
        }
    }

    var pullsUp: Bool {
        switch self {
        case .top, .topLeading, .topTrailing: true
        default: false
        }
    }

    var pullsDown: Bool {
        switch self {
        case .bottom, .bottomLeading, .bottomTrailing: true
        default: false
        }
    }

    var isCorner: Bool { pullsUp || pullsDown ? pullsLeft || pullsRight : false }

    var isVertical: Bool {
        switch self {
        case .top, .bottom: true
        default: false
        }
    }
}

/// Where a panel ends up when one of its edges is dragged.
///
/// Pure arithmetic, so every rule about minimums and edges can be checked
/// without a window.
enum PanelResizeGeometry {
    static func resized(
        anchor: AssistantAnchor,
        size: CGSize,
        edge: PanelResizeEdge,
        translation: CGSize,
        minimum: CGSize,
        within bounds: CGSize
    ) -> (anchor: AssistantAnchor, size: CGSize) {
        var x = anchor.x
        var y = anchor.y
        var width = size.width
        var height = size.height

        if edge.pullsRight {
            // Never past the window it lives in.
            let room = max(minimum.width, bounds.width - x - AssistantAnchor.margin)
            width = min(room, max(minimum.width, size.width + translation.width))
        }
        if edge.pullsLeft {
            // The right edge stays put, so the width and the corner move
            // together and by the same amount.
            let right = x + size.width
            let room = max(minimum.width, right - AssistantAnchor.margin)
            width = min(room, max(minimum.width, size.width - translation.width))
            x = right - width
        }
        if edge.pullsDown {
            let room = max(minimum.height, bounds.height - y - AssistantAnchor.margin)
            height = min(room, max(minimum.height, size.height + translation.height))
        }
        if edge.pullsUp {
            let bottom = y + size.height
            let room = max(minimum.height, bottom - AssistantAnchor.margin)
            height = min(room, max(minimum.height, size.height - translation.height))
            y = bottom - height
        }

        let grown = CGSize(width: width, height: height)
        return (
            AssistantAnchor.clamped(
                AssistantAnchor(x: x, y: y),
                size: grown,
                within: bounds
            ),
            grown
        )
    }
}
