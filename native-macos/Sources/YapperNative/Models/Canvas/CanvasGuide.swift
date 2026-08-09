import Foundation

/// An alignment line shown on the player while something is being dragged
/// across it. Captions, text and overlays all settle onto the same lines, so
/// they all speak in these.
struct CanvasGuide: Equatable, Identifiable {
    enum Axis: Equatable {
        /// A vertical line; it aligns the item's `x`.
        case vertical
        /// A horizontal line; it aligns the item's `y`.
        case horizontal
    }

    let axis: Axis
    /// Where the line sits, in stage fractions.
    let position: Double

    var id: String { "\(axis == .vertical ? "v" : "h")\(position)" }
}
