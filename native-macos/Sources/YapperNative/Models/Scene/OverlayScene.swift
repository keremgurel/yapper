import Foundation

/// A generated overlay's design: what to draw and how it moves, in the
/// language of docs/overlay-scene-format.md.
///
/// This is the saved, validated form. It is written to the project package by
/// `GeneratedAssetStore` and read back by the renderer; the model's reply
/// never reaches it without going through `SceneValidator` first.
struct OverlayScene: Codable, Equatable, Sendable {
    struct Background: Codable, Equatable, Sendable {
        var fill: SceneColor
        var cornerRadius: Double
        var opacity: Double

        init(fill: SceneColor, cornerRadius: Double = 0, opacity: Double = 1) {
            self.fill = fill
            self.cornerRadius = cornerRadius
            self.opacity = opacity
        }
    }

    var version: Int
    /// Seconds. The overlay on the timeline decides the real length: a longer
    /// one holds the last frame and a shorter one is cut.
    var duration: Double
    /// The most informative moment, for the library still.
    var poster: Double
    var background: Background?
    var nodes: [SceneNode]
    var animations: [SceneAnimation]

    init(
        version: Int = SceneLimits.version,
        duration: Double,
        poster: Double? = nil,
        background: Background? = nil,
        nodes: [SceneNode],
        animations: [SceneAnimation] = []
    ) {
        self.version = version
        self.duration = duration
        self.poster = poster ?? duration * SceneLimits.defaultPosterFraction
        self.background = background
        self.nodes = nodes
        self.animations = animations
    }

    /// Every node at any depth, in drawing order.
    var allNodes: [SceneNode] { nodes.flatMap(\.flattened) }

    /// The pictures this scene draws, by asset reference.
    var imageAssets: [String] {
        allNodes.compactMap { $0.kind == .image ? $0.asset : nil }
    }

    // MARK: - Files

    static func decode(_ data: Data) throws -> OverlayScene {
        try JSONDecoder().decode(OverlayScene.self, from: data)
    }

    func encoded() throws -> Data {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        return try encoder.encode(self)
    }
}
