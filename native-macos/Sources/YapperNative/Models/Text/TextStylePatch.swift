import Foundation

/// A sparse caption style: every field optional, `nil` meaning "not set".
///
/// One type does two jobs, because they are the same shape. On its way out of a
/// control it is a *patch* — only the field the creator just touched is set, so
/// applying it can never disturb the rest. Stored on a caption it is an
/// *override* — the handful of fields that card refuses to take from the shared
/// style, which is what keeps an Apply-to-all change visible on every card the
/// creator has not deliberately restyled.
struct TextStylePatch: Codable, Equatable, Sendable {
    // Layout
    var x: Double?
    var y: Double?
    var width: Double?

    // Text
    var font: TextLayerFont?
    var fontScale: Double?
    var textCase: TextCasing?
    var color: StudioColor?

    // Stroke
    var strokeEnabled: Bool?
    var strokeColor: StudioColor?
    var strokeWidth: Double?

    // Background
    var backgroundEnabled: Bool?
    var backgroundColor: StudioColor?
    var cornerRadius: Double?

    // Shadow
    var shadowEnabled: Bool?
    var shadowColor: StudioColor?
    var shadowRadius: Double?

    init(
        x: Double? = nil,
        y: Double? = nil,
        width: Double? = nil,
        font: TextLayerFont? = nil,
        fontScale: Double? = nil,
        textCase: TextCasing? = nil,
        color: StudioColor? = nil,
        strokeEnabled: Bool? = nil,
        strokeColor: StudioColor? = nil,
        strokeWidth: Double? = nil,
        backgroundEnabled: Bool? = nil,
        backgroundColor: StudioColor? = nil,
        cornerRadius: Double? = nil,
        shadowEnabled: Bool? = nil,
        shadowColor: StudioColor? = nil,
        shadowRadius: Double? = nil
    ) {
        self.x = x
        self.y = y
        self.width = width
        self.font = font
        self.fontScale = fontScale
        self.textCase = textCase
        self.color = color
        self.strokeEnabled = strokeEnabled
        self.strokeColor = strokeColor
        self.strokeWidth = strokeWidth
        self.backgroundEnabled = backgroundEnabled
        self.backgroundColor = backgroundColor
        self.cornerRadius = cornerRadius
        self.shadowEnabled = shadowEnabled
        self.shadowColor = shadowColor
        self.shadowRadius = shadowRadius
    }

    var isEmpty: Bool { self == TextStylePatch() }

    /// Every field the whole appearance covers, for "restyle this card exactly
    /// like this" — picking a template on one selected caption, for instance.
    /// Every field a whole style covers, layout included: what "make this one
    /// look exactly like that one" means when it is a card being pasted onto
    /// rather than a template being picked.
    static func everything(in style: TextStyle) -> TextStylePatch {
        var patch = everything(in: style.appearance)
        patch.x = style.x
        patch.y = style.y
        patch.width = style.width
        return patch
    }

    static func everything(in appearance: TextAppearance) -> TextStylePatch {
        TextStylePatch(
            font: appearance.font,
            fontScale: appearance.fontScale,
            textCase: appearance.textCase,
            color: appearance.color,
            strokeEnabled: appearance.strokeEnabled,
            strokeColor: appearance.strokeColor,
            strokeWidth: appearance.strokeWidth,
            backgroundEnabled: appearance.backgroundEnabled,
            backgroundColor: appearance.backgroundColor,
            cornerRadius: appearance.cornerRadius,
            shadowEnabled: appearance.shadowEnabled,
            shadowColor: appearance.shadowColor,
            shadowRadius: appearance.shadowRadius
        )
    }
}
