@preconcurrency import AppKit
import CoreText
import Foundation

/// Draws a run of text into a bitmap the way `TextAppearanceLayer` does, at 2x,
/// so the preview's layer and the export's layer show the same glyphs.
///
/// Core Animation's own text layer was passed over for the same reasons as in
/// the caption path: it cannot be told a line height, it renders differently on
/// screen and in a file, and there is no way to test what it drew.
enum SceneTextRasterizer {
    struct Style {
        var font: NSFont
        var color: CGColor
        var align: SceneNode.Align
        /// The distance between baselines, in points.
        var lineHeight: CGFloat
    }

    struct Rendering {
        let image: CGImage
        /// The bitmap's size in points, bleed included.
        let size: CGSize
        /// How far the glyph box was inset from the bitmap's edge, so the
        /// caller can place the bitmap to keep the glyphs where they belong.
        let bleed: CGFloat
    }

    static let scale: CGFloat = 2

    /// The bitmap for `text` wrapped inside `width` points. Text taller than
    /// `maximumHeight` is cut at the last line that fits.
    ///
    /// `canvasHeight` fixes the glyph box's height regardless of what the text
    /// measures, for a counter whose every face has to land on one layer.
    static func render(
        _ text: String,
        style: Style,
        width: CGFloat,
        maximumHeight: CGFloat,
        canvasHeight: CGFloat? = nil,
        maximumPixels: CGFloat? = nil
    ) -> Rendering? {
        let attributed = attributedString(text, style: style)
        let measured = measure(attributed, width: width, maximumHeight: maximumHeight)
        let boxHeight = canvasHeight ?? measured.height
        // Room for the glyphs that lean past their line box: italic
        // overhangs, a rounded face's swashes, the bottom of a descender at a
        // tall line height.
        let bleed = ceil(style.font.pointSize * 0.25)
        let size = CGSize(width: ceil(width) + bleed * 2, height: ceil(boxHeight) + bleed * 2)
        guard size.width > 0, size.height > 0 else { return nil }
        let scale = min(Self.scale, maximumPixels.map { sqrt($0 / (size.width * size.height)) } ?? Self.scale)
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

        // Core Text lays the frame out from its top edge, so a box taller than
        // the text leaves the spare room underneath: the node's top is where
        // the text is anchored.
        let framesetter = CTFramesetterCreateWithAttributedString(attributed)
        let box = CGRect(
            x: bleed,
            y: size.height - bleed - boxHeight,
            width: ceil(width),
            height: boxHeight
        )
        let frame = CTFramesetterCreateFrame(
            framesetter,
            CFRangeMake(0, attributed.length),
            CGPath(rect: box, transform: nil),
            nil
        )
        CTFrameDraw(frame, context)
        guard let image = context.makeImage() else { return nil }
        return Rendering(image: image, size: size, bleed: bleed)
    }

    /// The height `text` takes when wrapped inside `width`, capped.
    static func measure(_ text: String, style: Style, width: CGFloat, maximumHeight: CGFloat) -> CGSize {
        measure(attributedString(text, style: style), width: width, maximumHeight: maximumHeight)
    }

    private static func measure(
        _ attributed: NSAttributedString,
        width: CGFloat,
        maximumHeight: CGFloat
    ) -> CGSize {
        let framesetter = CTFramesetterCreateWithAttributedString(attributed)
        let size = CTFramesetterSuggestFrameSizeWithConstraints(
            framesetter,
            CFRangeMake(0, attributed.length),
            nil,
            CGSize(width: max(1, width), height: max(1, maximumHeight)),
            nil
        )
        return CGSize(
            width: min(width, ceil(size.width) + 1),
            height: min(maximumHeight, ceil(size.height) + 1)
        )
    }

    private static func attributedString(_ text: String, style: Style) -> NSAttributedString {
        let paragraph = NSMutableParagraphStyle()
        paragraph.lineBreakMode = .byWordWrapping
        paragraph.minimumLineHeight = style.lineHeight
        paragraph.maximumLineHeight = style.lineHeight
        switch style.align {
        case .left: paragraph.alignment = .left
        case .center: paragraph.alignment = .center
        case .right: paragraph.alignment = .right
        }
        return NSAttributedString(
            string: text,
            attributes: [
                .font: style.font,
                .foregroundColor: NSColor(cgColor: style.color) ?? .black,
                .paragraphStyle: paragraph,
            ]
        )
    }
}
