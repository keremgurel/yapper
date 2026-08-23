import Foundation

/// The look shared by every caption card: where the card sits on the stage, and
/// how its words are drawn. Any field can be overridden on a single caption; see
/// `ProjectCaption`.
struct TextStyle: Equatable, Sendable {
    /// Card centre, in stage fractions.
    var x: Double
    var y: Double
    /// Card width as a fraction of stage width.
    var width: Double
    /// Degrees clockwise about the middle of the card. Zero on every project
    /// saved before this existed, which is upright.
    var rotation: Double
    var appearance: TextAppearance

    init(
        x: Double = 0.5,
        y: Double = 0.82,
        width: Double = 0.88,
        rotation: Double = 0,
        appearance: TextAppearance = .captionDefault
    ) {
        self.x = x
        self.y = y
        self.width = width
        self.rotation = rotation
        self.appearance = appearance
    }

    /// Where captions sit and how they look out of the box.
    static let `default` = TextStyle()

    /// Where a new text layer sits and how it looks, which is also what its
    /// inspector resets to.
    static let textLayerDefault = TextStyle(
        x: 0.5,
        y: 0.5,
        width: 0.7,
        appearance: .textLayerDefault
    )

    // MARK: - Passthroughs
    //
    // The fields the rest of the editor reaches for most often, so callers can
    // say `style.fontScale` instead of `style.appearance.fontScale`.

    var font: TextLayerFont {
        get { appearance.font }
        set { appearance.font = newValue }
    }

    var fontScale: Double {
        get { appearance.fontScale }
        set { appearance.fontScale = newValue }
    }

    var textCase: TextCasing {
        get { appearance.textCase }
        set { appearance.textCase = newValue }
    }

    // MARK: - Bounds

    static let minimumWidth = 0.2
    static let maximumWidth = 1.0

    static func clampFontScale(_ value: Double) -> Double {
        TextAppearance.clamp(value, to: TextAppearance.fontScaleLimits)
    }

    static func clampWidth(_ value: Double) -> Double {
        min(maximumWidth, max(minimumWidth, value))
    }

    /// Keeps a dragged card fully reachable: never pinned so far out that its
    /// grab area leaves the stage.
    static func clampPosition(_ value: Double) -> Double {
        min(0.95, max(0.05, value))
    }

    /// Kept in (-180, 180], the way the main track's angle is, so the readout
    /// on the canvas and the one in the inspector cannot disagree.
    static func clampRotation(_ value: Double) -> Double {
        VideoFraming.wrap(value)
    }

    var rotationRadians: Double { rotation * .pi / 180 }
}

// MARK: - Codable

extension TextStyle: Codable {
    private enum CodingKeys: String, CodingKey {
        case x, y, width, rotation, appearance
    }

    /// Projects saved before captions carried a full appearance kept their look
    /// in three flat fields and a `background` enum. They are read back into an
    /// appearance here, so an existing edit never changes look underneath you.
    private enum LegacyKeys: String, CodingKey {
        case font, fontScale, textCase, background
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        x = try container.decode(Double.self, forKey: .x)
        y = try container.decode(Double.self, forKey: .y)
        width = try container.decode(Double.self, forKey: .width)
        rotation = Self.clampRotation(
            try container.decodeIfPresent(Double.self, forKey: .rotation) ?? 0
        )
        if let appearance = try container.decodeIfPresent(TextAppearance.self, forKey: .appearance) {
            self.appearance = appearance
            return
        }
        let legacy = try decoder.container(keyedBy: LegacyKeys.self)
        appearance = TextAppearance.fromLegacy(
            // A project saved before captions could be plain was drawn on a
            // black card, and has to keep it.
            style: try legacy.decodeIfPresent(TextLayerStyle.self, forKey: .background) ?? .blackCard,
            font: try legacy.decodeIfPresent(TextLayerFont.self, forKey: .font) ?? .modern,
            fontScale: try legacy.decodeIfPresent(Double.self, forKey: .fontScale) ?? 0.024,
            textCase: try legacy.decodeIfPresent(TextCasing.self, forKey: .textCase) ?? .asSpoken
        )
    }
}
