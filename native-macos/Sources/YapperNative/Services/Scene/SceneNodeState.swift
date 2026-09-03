import Foundation

/// Everything about one node that can move, resolved at one moment.
///
/// The still renderer asks for the state at the poster time, the animated one
/// asks for it at every sample time and turns the answers into keyframes. Both
/// read the same numbers from `SceneTimeline`, which is what keeps a poster a
/// frame of the export rather than a picture of something similar.
struct SceneNodeState: Equatable, Sendable {
    /// Fractions of the containing box.
    var x: Double
    var y: Double
    var width: Double
    var height: Double
    var opacity: Double
    /// `scale` folded in, so a node scaled both ways ends up one number per axis.
    var scaleX: Double
    var scaleY: Double
    /// Degrees clockwise.
    var rotate: Double
    var strokeEnd: Double
    /// Progress from a number node's `from` to its `to`.
    var value: Double

    static func resolve(node: SceneNode, timeline: SceneTimeline, at time: Double) -> SceneNodeState {
        func read(_ property: SceneAnimation.Property, resting: Double) -> Double {
            timeline.value(property, of: node.id, at: time, resting: resting)
        }
        let scale = read(.scale, resting: 1)
        return SceneNodeState(
            x: read(.x, resting: node.x),
            y: read(.y, resting: node.y),
            width: max(0, read(.width, resting: node.width)),
            height: max(0, read(.height, resting: node.height)),
            opacity: min(1, max(0, read(.opacity, resting: node.opacity))),
            scaleX: scale * read(.scaleX, resting: 1),
            scaleY: scale * read(.scaleY, resting: 1),
            rotate: read(.rotate, resting: node.rotate),
            strokeEnd: min(1, max(0, read(.strokeEnd, resting: 1))),
            value: read(.value, resting: 1)
        )
    }

    /// The node's box in points inside a parent of `parentSize`, from the top
    /// left. A line's box is the rectangle its two ends span, whichever way
    /// round they were written.
    func frame(of node: SceneNode, parentSize: CGSize) -> CGRect {
        var originX = x
        var originY = y
        if node.kind == .line {
            originX = min(x, node.x2 ?? x)
            originY = min(y, node.y2 ?? y)
        }
        return SceneGeometry.topLeftFrame(
            x: originX,
            y: originY,
            width: width,
            height: height,
            parentSize: parentSize
        )
    }
}
