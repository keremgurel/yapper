import SwiftUI

/// Draws a run of text the way a `TextAppearance` describes it, and the way the
/// export will burn it in. Captions, text layers and the inspector previews all
/// go through here, so what the creator picks is what they get.
struct AppearanceText: View {
    let text: String
    let appearance: TextAppearance
    /// Cap height in points. The caller resolves it from the stage size, because
    /// only the caller knows how big the stage is.
    let fontSize: CGFloat
    var lineLimit: Int? = 3
    var minimumScaleFactor: CGFloat = 0.72

    var body: some View {
        words
            .padding(.horizontal, fontSize * appearance.horizontalPadding)
            .padding(.vertical, fontSize * appearance.verticalPadding)
            .background {
                if appearance.backgroundEnabled {
                    RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                        .fill(appearance.backgroundColor.swiftUIColor)
                        .shadow(
                            color: cardShadowColor,
                            radius: shadowRadius,
                            y: shadowRadius * 0.25
                        )
                }
            }
    }

    /// The outline is faked with copies of the text ringed behind the fill.
    /// SwiftUI has no glyph stroke; the export uses a real one, sized to match.
    private var words: some View {
        ZStack {
            if appearance.strokeEnabled, strokeRadius > 0.2 {
                ForEach(0 ..< AppearanceText.strokeSteps, id: \.self) { step in
                    let angle = Double(step) / Double(AppearanceText.strokeSteps) * 2 * .pi
                    label
                        .foregroundStyle(appearance.strokeColor.swiftUIColor)
                        .offset(
                            x: cos(angle) * strokeRadius,
                            y: sin(angle) * strokeRadius
                        )
                }
            }
            label
                .foregroundStyle(appearance.color.swiftUIColor)
                .shadow(
                    color: textShadowColor,
                    radius: shadowRadius,
                    y: shadowRadius * 0.2
                )
        }
        // Seventeen copies of the same words, and every one of them carries a
        // minimum scale factor, which makes SwiftUI fit the type by trying it
        // at several sizes. That is a lot of text fitting for one card, and it
        // ran again on every layout pass — so dragging a caption re-fitted it
        // on every mouse event, and the card fell behind the pointer.
        //
        // Rasterising the ring once means a drag moves a picture. The content
        // only changes when the words or the styling do, which is when this
        // renders again.
        .drawingGroup()
    }

    private var label: some View {
        Text(appearance.displayText(text))
            .font(.system(size: fontSize, weight: .heavy, design: appearance.font.canvasDesign))
            .multilineTextAlignment(.center)
            .lineLimit(lineLimit)
            .minimumScaleFactor(minimumScaleFactor)
            .fixedSize(horizontal: false, vertical: true)
    }

    /// Enough copies that the ring reads as a solid outline at the stroke widths
    /// the slider allows, and few enough to stay cheap while scrubbing.
    private static let strokeSteps = 16

    private var strokeRadius: CGFloat { fontSize * appearance.strokeWidth / 2 }
    private var cornerRadius: CGFloat { fontSize * appearance.cornerRadius }
    private var shadowRadius: CGFloat {
        appearance.shadowEnabled ? fontSize * appearance.shadowRadius : 0
    }

    /// A card casts the shadow when there is one; otherwise the words do.
    private var cardShadowColor: Color {
        appearance.shadowEnabled ? appearance.shadowColor.swiftUIColor : .clear
    }

    private var textShadowColor: Color {
        appearance.shadowEnabled && !appearance.backgroundEnabled
            ? appearance.shadowColor.swiftUIColor
            : .clear
    }
}

extension StudioColor {
    var swiftUIColor: Color {
        Color(.sRGB, red: red, green: green, blue: blue, opacity: opacity)
    }
}

extension TextLayerFont {
    /// The face used when drawing on the canvas and burning into the export.
    var canvasDesign: Font.Design {
        switch self {
        case .modern: .default
        case .rounded: .rounded
        case .editorial: .serif
        }
    }

    /// The face itself, so a picker can show what each option looks like.
    func previewFont(size: CGFloat = 11) -> Font {
        switch self {
        case .modern: .system(size: size, weight: .bold)
        case .rounded: .system(size: size, weight: .bold, design: .rounded)
        case .editorial: .system(size: size, weight: .semibold, design: .serif)
        }
    }
}
