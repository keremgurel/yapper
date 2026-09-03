import Foundation

/// One property of one node moving between two values over a stretch of the
/// scene's own time.
struct SceneAnimation: Codable, Equatable, Sendable {
    enum Property: String, Codable, CaseIterable, Sendable {
        case opacity, x, y, scaleX, scaleY, scale, rotate, value, strokeEnd, width, height
    }

    /// A node id, or `*` for every top level node.
    var node: String
    var property: Property
    /// `nil` means the node's own value.
    var from: Double?
    var to: Double
    var start: Double
    var end: Double
    var easing: SceneEasing
    /// Seconds between successive children when `node` is a group or `*`.
    var stagger: Double

    static let everyNode = "*"

    init(
        node: String,
        property: Property,
        from: Double? = nil,
        to: Double,
        start: Double,
        end: Double,
        easing: SceneEasing = .default,
        stagger: Double = 0
    ) {
        self.node = node
        self.property = property
        self.from = from
        self.to = to
        self.start = start
        self.end = end
        self.easing = easing
        self.stagger = stagger
    }

    var targetsEveryNode: Bool { node == Self.everyNode }
}
