import Foundation

/// Everything about how a run of text is drawn, shared by caption cards and
/// standalone text layers so both inspectors can speak the same language.
///
/// The size-relative fields (`fontScale`, `strokeWidth`, `cornerRadius`,
/// `shadowRadius`) are fractions, never points: a look picked on a 1080p preview
/// has to survive being burned into a 4K export at the same proportions.
struct TextAppearance: Codable, Equatable, Sendable {
    // MARK: Text
    var font: TextLayerFont
    /// Cap height as a fraction of stage height.
    var fontScale: Double
    var textCase: TextCasing
    var color: StudioColor

    // MARK: Stroke
    var strokeEnabled: Bool
    var strokeColor: StudioColor
    /// Outline thickness as a fraction of the font size.
    var strokeWidth: Double

    // MARK: Background
    var backgroundEnabled: Bool
    var backgroundColor: StudioColor
    /// Corner radius as a fraction of the font size.
    var cornerRadius: Double

    // MARK: Shadow
    var shadowEnabled: Bool
    var shadowColor: StudioColor
    /// Blur radius as a fraction of the font size.
    var shadowRadius: Double

    init(
        font: TextLayerFont = .modern,
        fontScale: Double = 0.024,
        textCase: TextCasing = .asSpoken,
        color: StudioColor = .white,
        strokeEnabled: Bool = false,
        strokeColor: StudioColor = .black,
        strokeWidth: Double = 0.07,
        backgroundEnabled: Bool = false,
        backgroundColor: StudioColor = StudioColor.black.withOpacity(0.86),
        cornerRadius: Double = 0.3,
        shadowEnabled: Bool = true,
        shadowColor: StudioColor = StudioColor.black.withOpacity(0.85),
        shadowRadius: Double = 0.3
    ) {
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

    /// Padding around the words when they sit on a card, again as a fraction of
    /// the font size. Derived rather than stored: a card that hugs its text at
    /// one size has to hug it at every size.
    var horizontalPadding: Double { backgroundEnabled ? 0.52 : 0.06 }
    var verticalPadding: Double { backgroundEnabled ? 0.30 : 0.06 }

    func displayText(_ text: String) -> String { textCase.apply(to: text) }
}

// MARK: - Bounds

extension TextAppearance {
    /// What the model will store. Wide enough for both kinds of text; the
    /// sliders offer the narrower range that suits each.
    static let fontScaleLimits = 0.010 ... 0.220
    /// The UI shows font scale times 1000, so the creator picks a whole number
    /// between 12 and 140 rather than a fraction.
    static let fontScaleRange = 0.012 ... 0.140
    /// Text layers are set larger than captions and get their own headroom.
    static let layerFontScaleRange = 0.020 ... 0.200
    static let strokeWidthRange = 0.0 ... 0.24
    static let cornerRadiusRange = 0.0 ... 1.0
    static let shadowRadiusRange = 0.0 ... 1.0

    static func clamp(_ value: Double, to range: ClosedRange<Double>) -> Double {
        min(range.upperBound, max(range.lowerBound, value))
    }
}

// MARK: - Presets

extension TextAppearance {
    /// The look captions ship with: heavy white type carrying its own contrast
    /// in a shadow, nothing boxing it in.
    static let captionDefault = TextAppearance()

    /// A standalone text layer is bigger than a caption and defaults to the
    /// rounded face the hook tool uses.
    static let textLayerDefault = TextAppearance(
        font: .modern,
        fontScale: 0.05,
        shadowEnabled: true
    )

    static let hookDefault = TextAppearance(
        font: .rounded,
        fontScale: 0.043,
        color: .black,
        backgroundEnabled: true,
        backgroundColor: StudioColor.white.withOpacity(0.96),
        shadowEnabled: false
    )

    /// Rebuilds an appearance from the three-way `TextLayerStyle` enum the
    /// editor shipped before colour, stroke and shadow were editable, so an
    /// existing project opens looking exactly the way it was saved.
    static func fromLegacy(
        style: TextLayerStyle,
        font: TextLayerFont,
        fontScale: Double,
        textCase: TextCasing = .asSpoken
    ) -> TextAppearance {
        switch style {
        case .plain:
            TextAppearance(
                font: font,
                fontScale: fontScale,
                textCase: textCase,
                color: .white,
                shadowEnabled: true
            )
        case .blackCard:
            TextAppearance(
                font: font,
                fontScale: fontScale,
                textCase: textCase,
                color: .white,
                backgroundEnabled: true,
                backgroundColor: StudioColor.black.withOpacity(0.86),
                shadowEnabled: false
            )
        case .whiteCard:
            TextAppearance(
                font: font,
                fontScale: fontScale,
                textCase: textCase,
                color: .black,
                backgroundEnabled: true,
                backgroundColor: StudioColor.white.withOpacity(0.96),
                shadowEnabled: false
            )
        }
    }
}
