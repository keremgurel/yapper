import Foundation

/// One drawable thing in a scene. See docs/overlay-scene-format.md.
///
/// Positions are fractions of the scene's box, measured from its top left;
/// every other size is a fraction of the box height. Stored strictly typed
/// because by the time a scene is saved it has been through `SceneValidator`;
/// the tolerant reading of the model's reply lives there, not here.
struct SceneNode: Codable, Equatable, Sendable, Identifiable {
    enum Kind: String, Codable, Sendable {
        case text, number, rect, ellipse, line, path, icon, image, group
    }

    enum Font: String, Codable, CaseIterable, Sendable {
        case modern, rounded, editorial

        var layerFont: TextLayerFont {
            switch self {
            case .modern: .modern
            case .rounded: .rounded
            case .editorial: .editorial
            }
        }
    }

    enum Weight: String, Codable, CaseIterable, Sendable {
        case regular, medium, semibold, bold, black
    }

    enum Align: String, Codable, CaseIterable, Sendable {
        case left, center, right
    }

    enum Anchor: String, Codable, CaseIterable, Sendable {
        case center, left, right, top, bottom, topLeft, topRight, bottomLeft, bottomRight

        /// The pivot as fractions of the node's own box.
        var unitPoint: (x: Double, y: Double) {
            switch self {
            case .center: (0.5, 0.5)
            case .left: (0, 0.5)
            case .right: (1, 0.5)
            case .top: (0.5, 0)
            case .bottom: (0.5, 1)
            case .topLeft: (0, 0)
            case .topRight: (1, 0)
            case .bottomLeft: (0, 1)
            case .bottomRight: (1, 1)
            }
        }
    }

    enum NumberFormat: String, Codable, CaseIterable, Sendable {
        case plain, grouped, percent, compact, decimal1
    }

    enum ImageFit: String, Codable, CaseIterable, Sendable {
        case contain, cover
    }

    var id: String
    var kind: Kind
    var x: Double
    var y: Double
    var width: Double
    var height: Double
    var opacity: Double
    var rotate: Double
    var anchor: Anchor

    // text and number
    var text: String?
    var font: Font?
    var weight: Weight?
    var size: Double?
    var color: SceneColor?
    var align: Align?
    var lineHeight: Double?
    var uppercase: Bool?

    // number
    var from: Double?
    var to: Double?
    var format: NumberFormat?
    var prefix: String?
    var suffix: String?

    // shapes and paths
    var fill: SceneColor?
    var stroke: SceneColor?
    var strokeWidth: Double?
    var cornerRadius: Double?
    var dashed: Bool?

    // line
    var x2: Double?
    var y2: Double?

    // path
    var d: String?

    // icon
    var icon: String?

    // image
    var asset: String?
    var fit: ImageFit?

    // group
    var children: [SceneNode]?

    private enum CodingKeys: String, CodingKey {
        case id, x, y, width, height, opacity, rotate, anchor
        case kind = "type"
        case text, font, weight, size, color, align, lineHeight, uppercase
        case from, to, format, prefix, suffix
        case fill, stroke, strokeWidth, cornerRadius, dashed
        case x2, y2, d, icon, asset, fit, children
    }

    init(
        id: String,
        kind: Kind,
        x: Double,
        y: Double,
        width: Double,
        height: Double,
        opacity: Double = 1,
        rotate: Double = 0,
        anchor: Anchor = .center
    ) {
        self.id = id
        self.kind = kind
        self.x = x
        self.y = y
        self.width = width
        self.height = height
        self.opacity = opacity
        self.rotate = rotate
        self.anchor = anchor
    }

    /// True for the kinds that draw an outline `strokeEnd` can run along.
    var canStroke: Bool {
        switch kind {
        case .path, .line, .rect, .ellipse, .icon: true
        default: false
        }
    }

    var isTypographic: Bool { kind == .text || kind == .number }

    /// Every node in this subtree, depth first, including this one.
    var flattened: [SceneNode] {
        [self] + (children ?? []).flatMap(\.flattened)
    }
}
