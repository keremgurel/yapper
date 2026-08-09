@preconcurrency import AppKit
import CoreText
import QuartzCore

/// Turns a `TextAppearance` into the Core Animation layer the export burns in.
/// Captions and text layers share it so a look picked in the inspector renders
/// the same in the file as it does on the canvas.
///
/// The words are drawn into a bitmap here rather than handed to a `CATextLayer`.
/// Core Animation's own text layer ignores half of what an appearance carries —
/// the stroke needs Core Text's spelling of the attribute, and a layer shadow is
/// derived from the layer, not the glyphs — so drawing it once, ourselves, is
/// both the only way to get every property into the file and the only way to
/// test that it got there.
enum TextAppearanceLayer {
    /// - Parameters:
    ///   - centerX: card centre across the stage, as a fraction.
    ///   - centerY: card centre down the stage, as a fraction. Measured from the
    ///     top the way the preview lays it out; Core Animation counts from the
    ///     bottom, so the flip happens here and nowhere else.
    ///   - maximumWidth: how much of the stage width the card may take.
    ///   - maximumHeight: how much of the stage height the card may take.
    static func make(
        text: String,
        appearance: TextAppearance,
        renderSize: CGSize,
        centerX: Double,
        centerY: Double,
        maximumWidth: Double,
        maximumHeight: Double
    ) -> CALayer {
        let fontSize = max(10, renderSize.height * appearance.fontScale)
        let attributed = attributedString(text, appearance: appearance, fontSize: fontSize)

        let horizontalPadding = fontSize * appearance.horizontalPadding
        let verticalPadding = fontSize * appearance.verticalPadding
        let widthLimit = renderSize.width * maximumWidth
        let heightLimit = renderSize.height * maximumHeight
        let textLimit = CGSize(
            width: max(fontSize, widthLimit - horizontalPadding * 2),
            height: max(fontSize, heightLimit - verticalPadding * 2)
        )
        let textSize = measure(attributed, within: textLimit)

        let boxSize = CGSize(
            width: min(widthLimit, textSize.width + horizontalPadding * 2),
            height: min(heightLimit, textSize.height + verticalPadding * 2)
        )

        let container = CALayer()
        container.frame = CGRect(
            x: renderSize.width * centerX - boxSize.width / 2,
            y: renderSize.height * (1 - centerY) - boxSize.height / 2,
            width: boxSize.width,
            height: boxSize.height
        )
        if appearance.backgroundEnabled {
            container.backgroundColor = appearance.backgroundColor.cgColor
            container.cornerRadius = fontSize * appearance.cornerRadius
            // A card's shadow is cast by the card, so the layer's own is exactly
            // the right shape for it.
            if appearance.shadowEnabled {
                container.shadowColor = appearance.shadowColor.opaqueCGColor
                container.shadowOpacity = Float(appearance.shadowColor.opacity)
                container.shadowRadius = fontSize * appearance.shadowRadius
                container.shadowOffset = CGSize(width: 0, height: -fontSize * appearance.shadowRadius * 0.25)
            }
        }

        // Room for the outline and the blur to spread into, or they clip at the
        // edge of the bitmap.
        let bleed = ceil(strokeInset(appearance, fontSize: fontSize) + shadowBleed(appearance, fontSize: fontSize))
        if let image = textImage(attributed, textSize: textSize, bleed: bleed, appearance: appearance, fontSize: fontSize) {
            let textLayer = CALayer()
            textLayer.contents = image
            // The bitmap is drawn at 2x and the frame is in points, so the
            // default resize gravity maps one onto the other exactly.
            textLayer.contentsScale = 2
            textLayer.frame = CGRect(
                x: (boxSize.width - textSize.width) / 2 - bleed,
                y: (boxSize.height - textSize.height) / 2 - bleed,
                width: textSize.width + bleed * 2,
                height: textSize.height + bleed * 2
            )
            container.addSublayer(textLayer)
        }
        return container
    }

    // MARK: - Drawing

    /// The words, their outline and their shadow, rasterised once.
    private static func textImage(
        _ attributed: NSAttributedString,
        textSize: CGSize,
        bleed: CGFloat,
        appearance: TextAppearance,
        fontSize: CGFloat,
        scale: CGFloat = 2
    ) -> CGImage? {
        let size = CGSize(width: textSize.width + bleed * 2, height: textSize.height + bleed * 2)
        guard size.width > 0, size.height > 0 else { return nil }
        guard let context = CGContext(
            data: nil,
            width: Int((size.width * scale).rounded(.up)),
            height: Int((size.height * scale).rounded(.up)),
            bitsPerComponent: 8,
            bytesPerRow: 0,
            space: CGColorSpace(name: CGColorSpace.sRGB)!,
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else { return nil }
        context.scaleBy(x: scale, y: scale)

        // Without a card behind them the words cast their own shadow. Drawing
        // the whole run inside a transparency layer means one shadow under the
        // finished line rather than one per glyph landing on its neighbours.
        let castsShadow = appearance.shadowEnabled && !appearance.backgroundEnabled
        if castsShadow {
            context.setShadow(
                offset: CGSize(width: 0, height: -fontSize * appearance.shadowRadius * 0.2),
                blur: fontSize * appearance.shadowRadius,
                color: appearance.shadowColor.cgColor
            )
            context.beginTransparencyLayer(auxiliaryInfo: nil)
        }

        let framesetter = CTFramesetterCreateWithAttributedString(attributed)
        let path = CGPath(
            rect: CGRect(x: bleed, y: bleed, width: textSize.width, height: textSize.height),
            transform: nil
        )
        let frame = CTFramesetterCreateFrame(
            framesetter,
            CFRangeMake(0, attributed.length),
            path,
            nil
        )
        CTFrameDraw(frame, context)

        if castsShadow { context.endTransparencyLayer() }
        return context.makeImage()
    }

    /// How much space the laid-out words need, measured the same way they are
    /// drawn so a line can never be laid out and then dropped for want of room.
    private static func measure(_ attributed: NSAttributedString, within limit: CGSize) -> CGSize {
        let framesetter = CTFramesetterCreateWithAttributedString(attributed)
        let size = CTFramesetterSuggestFrameSizeWithConstraints(
            framesetter,
            CFRangeMake(0, attributed.length),
            nil,
            limit,
            nil
        )
        return CGSize(
            width: min(limit.width, ceil(size.width) + 1),
            height: min(limit.height, ceil(size.height) + 1)
        )
    }

    private static func attributedString(
        _ text: String,
        appearance: TextAppearance,
        fontSize: CGFloat
    ) -> NSAttributedString {
        let paragraph = NSMutableParagraphStyle()
        paragraph.alignment = .center
        paragraph.lineBreakMode = .byWordWrapping

        var attributes: [NSAttributedString.Key: Any] = [
            .font: font(for: appearance.font, size: fontSize),
            .foregroundColor: appearance.color.nsColor,
            .paragraphStyle: paragraph,
        ]
        if appearance.strokeEnabled, appearance.strokeWidth > 0 {
            // Negative means "fill *and* stroke"; the magnitude is a percentage
            // of the font size, which is exactly how the model stores it. Core
            // Text reads its own keys and ignores AppKit's, so both are set.
            attributes[.strokeWidth] = -appearance.strokeWidth * 100
            attributes[.strokeColor] = appearance.strokeColor.nsColor
            attributes[.init(kCTStrokeWidthAttributeName as String)] = -appearance.strokeWidth * 100
            attributes[.init(kCTStrokeColorAttributeName as String)] = appearance.strokeColor.cgColor
        }
        return NSAttributedString(string: appearance.displayText(text), attributes: attributes)
    }

    // MARK: - Bleed

    /// An outline grows outward from the glyphs, so the bitmap has to give it
    /// room or the widest letters clip.
    private static func strokeInset(_ appearance: TextAppearance, fontSize: CGFloat) -> CGFloat {
        guard appearance.strokeEnabled else { return 0 }
        return fontSize * appearance.strokeWidth / 2
    }

    private static func shadowBleed(_ appearance: TextAppearance, fontSize: CGFloat) -> CGFloat {
        guard appearance.shadowEnabled, !appearance.backgroundEnabled else { return 0 }
        return fontSize * appearance.shadowRadius * 2.5
    }

    static func font(for family: TextLayerFont, size: CGFloat) -> NSFont {
        switch family {
        case .modern:
            return NSFont.systemFont(ofSize: size, weight: .bold)
        case .rounded:
            let base = NSFont.systemFont(ofSize: size, weight: .heavy)
            if let descriptor = base.fontDescriptor.withDesign(.rounded),
               let rounded = NSFont(descriptor: descriptor, size: size)
            {
                return rounded
            }
            return base
        case .editorial:
            return NSFont(name: "New York", size: size)
                ?? NSFont.systemFont(ofSize: size, weight: .semibold)
        }
    }
}

extension StudioColor {
    var nsColor: NSColor {
        NSColor(srgbRed: red, green: green, blue: blue, alpha: opacity)
    }

    var cgColor: CGColor { nsColor.cgColor }

    /// The colour at full opacity. `CALayer` keeps shadow colour and shadow
    /// opacity in separate properties, so the alpha has to be handed over
    /// separately rather than baked in twice.
    var opaqueCGColor: CGColor {
        NSColor(srgbRed: red, green: green, blue: blue, alpha: 1).cgColor
    }
}
