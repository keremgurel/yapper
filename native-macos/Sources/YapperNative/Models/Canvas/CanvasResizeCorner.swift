import CoreGraphics

/// Which corner handle a resize drag started from, and which way that corner
/// grows. Shared by every resizable thing on the player canvas.
enum CanvasResizeCorner: CaseIterable, Equatable, Sendable {
    case topLeading
    case topTrailing
    case bottomLeading
    case bottomTrailing

    var xSign: Double {
        switch self {
        case .topLeading, .bottomLeading: -1
        case .topTrailing, .bottomTrailing: 1
        }
    }

    var ySign: Double {
        switch self {
        case .topLeading, .topTrailing: -1
        case .bottomLeading, .bottomTrailing: 1
        }
    }

    var xOffset: CGFloat { CGFloat(xSign) * 7 }
    var yOffset: CGFloat { CGFloat(ySign) * 7 }

    var accessibilityName: String {
        switch self {
        case .topLeading: "top left"
        case .topTrailing: "top right"
        case .bottomLeading: "bottom left"
        case .bottomTrailing: "bottom right"
        }
    }
}
