import AppKit
import Testing

@testable import YapperNative

/// The export path, checked by actually drawing it. A property that renders in
/// the preview but not in the file is worse than one that does not exist, so
/// each of these renders the real Core Animation layer and looks at the pixels.
@MainActor
@Suite struct TextAppearanceLayerTests {
    private let renderSize = CGSize(width: 400, height: 400)

    private func render(_ appearance: TextAppearance, text: String = "HELLO") -> [Pixel] {
        let layer = TextAppearanceLayer.make(
            text: text,
            appearance: appearance,
            renderSize: renderSize,
            centerX: 0.5,
            centerY: 0.5,
            maximumWidth: 0.9,
            maximumHeight: 0.5
        )
        return Pixel.sample(layer: layer, size: renderSize)
    }

    private func base(_ changes: (inout TextAppearance) -> Void) -> TextAppearance {
        var appearance = TextAppearance(fontScale: 0.12, shadowEnabled: false)
        changes(&appearance)
        return appearance
    }

    @Test func plainWhiteTextDrawsOnlyWhitePixels() {
        let pixels = render(base { _ in })
        #expect(pixels.contains { $0.isNearlyWhite && $0.alpha > 0.9 })
        #expect(!pixels.contains { $0.isNearlyBlack && $0.alpha > 0.5 })
    }

    @Test func aBackgroundColorReachesTheFrame() {
        let pixels = render(
            base {
                $0.backgroundEnabled = true
                $0.backgroundColor = StudioColor(hex: "#123456")!
            }
        )
        #expect(pixels.contains { $0.matches(StudioColor(hex: "#123456")!) })
    }

    @Test func anOutlineDrawsInItsOwnColor() {
        let plain = render(base { _ in })
        let outlined = render(
            base {
                $0.strokeEnabled = true
                $0.strokeColor = StudioColor(hex: "#FF0000")!
                $0.strokeWidth = 0.16
            }
        )
        #expect(!plain.contains { $0.isStrongRed })
        #expect(outlined.contains { $0.isStrongRed })
    }

    @Test func theFillColorIsWhatGetsDrawn() {
        let pixels = render(base { $0.color = StudioColor(hex: "#00FF00")! })
        #expect(pixels.contains { $0.green > 0.8 && $0.red < 0.4 && $0.blue < 0.4 })
    }

    @Test func casingIsAppliedOnTheWayOut() {
        let upper = render(base { $0.textCase = .upper }, text: "hello")
        let asTyped = render(base { $0.textCase = .asSpoken }, text: "hello")
        // Uppercase letters cover more of the box, so the two differ in ink.
        #expect(upper.filter(\.hasInk).count != asTyped.filter(\.hasInk).count)
    }
}

/// One sampled pixel, plus the rasteriser that produces them.
private struct Pixel {
    var red: Double
    var green: Double
    var blue: Double
    var alpha: Double

    var hasInk: Bool { alpha > 0.35 }
    var isNearlyWhite: Bool { red > 0.85 && green > 0.85 && blue > 0.85 }
    var isNearlyBlack: Bool { red < 0.2 && green < 0.2 && blue < 0.2 }
    var isStrongRed: Bool { red > 0.6 && green < 0.35 && blue < 0.35 && alpha > 0.5 }

    func matches(_ color: StudioColor, tolerance: Double = 0.04) -> Bool {
        abs(red - color.red) < tolerance
            && abs(green - color.green) < tolerance
            && abs(blue - color.blue) < tolerance
            && alpha > 0.5
    }

    @MainActor
    static func sample(layer: CALayer, size: CGSize) -> [Pixel] {
        let width = Int(size.width)
        let height = Int(size.height)
        var raw = [UInt8](repeating: 0, count: width * height * 4)
        guard let context = CGContext(
            data: &raw,
            width: width,
            height: height,
            bitsPerComponent: 8,
            bytesPerRow: width * 4,
            space: CGColorSpace(name: CGColorSpace.sRGB)!,
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else { return [] }
        layer.render(in: context)

        return stride(from: 0, to: raw.count, by: 4).compactMap { index in
            let alpha = Double(raw[index + 3]) / 255
            guard alpha > 0.01 else { return nil }
            // The buffer is premultiplied, so the colour has to be recovered
            // before it can be compared with the one that was asked for.
            return Pixel(
                red: Double(raw[index]) / 255 / alpha,
                green: Double(raw[index + 1]) / 255 / alpha,
                blue: Double(raw[index + 2]) / 255 / alpha,
                alpha: alpha
            )
        }
    }
}


/// The way the first exported captions went wrong, kept honest here.
@MainActor
@Suite struct TextAppearanceShadowTests {
    private let renderSize = CGSize(width: 400, height: 400)

    /// The bug in the first export: bare words cast a shadow shaped like the
    /// layer they sat in rather than like themselves, which burned a dark bar
    /// across the frame. A real text shadow leaves the corners of the box alone.
    @Test func aShadowUnderBareWordsLeavesTheCornersClear() {
        let ink = InkMap.of(
            TextAppearanceLayer.make(
                text: "l l",
                appearance: TextAppearance(
                    fontScale: 0.1,
                    color: .white,
                    shadowEnabled: true,
                    shadowColor: StudioColor.black.withOpacity(0.85),
                    shadowRadius: 0.3
                ),
                renderSize: renderSize,
                centerX: 0.5,
                centerY: 0.5,
                maximumWidth: 0.9,
                maximumHeight: 0.5
            ),
            size: renderSize
        )

        #expect(ink.darkPixels > 0, "the shadow has to be drawn at all")
        #expect(ink.darkCornerPixels == 0, "a bar would darken the corners too")
    }

    @Test func aCardCastsItsShadowFromTheCard() {
        let carded = TextAppearanceLayer.make(
            text: "l l",
            appearance: TextAppearance(
                fontScale: 0.1,
                backgroundEnabled: true,
                backgroundColor: StudioColor.black.withOpacity(0.86),
                shadowEnabled: true
            ),
            renderSize: renderSize,
            centerX: 0.5,
            centerY: 0.5,
            maximumWidth: 0.9,
            maximumHeight: 0.5
        )
        // Here the card is the shape doing the casting, so the layer shadow is
        // the right tool and a wide dark region is the correct answer.
        #expect(carded.shadowOpacity > 0)
        #expect(carded.shadowRadius > 0)
    }
}

/// Where a rendered layer put its ink, split into the middle of its box and the
/// corners it should have left alone.
private enum InkMap {
    struct Result {
        var darkPixels: Int
        var darkCornerPixels: Int
    }

    @MainActor
    static func of(_ layer: CALayer, size: CGSize) -> Result {
        let width = Int(size.width)
        let height = Int(size.height)
        var raw = [UInt8](repeating: 0, count: width * height * 4)
        guard let context = CGContext(
            data: &raw,
            width: width,
            height: height,
            bitsPerComponent: 8,
            bytesPerRow: width * 4,
            space: CGColorSpace(name: CGColorSpace.sRGB)!,
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else { return Result(darkPixels: 0, darkCornerPixels: 0) }
        // `render(in:)` draws the layer from its own bounds origin, so the box
        // under test is the layer's size sitting at 0,0.
        layer.render(in: context)

        let box = layer.bounds
        let corner = CGSize(width: box.width * 0.18, height: box.height * 0.3)
        var dark = 0
        var darkCorners = 0
        for y in 0 ..< height {
            for x in 0 ..< width {
                let index = (y * width + x) * 4
                let alpha = Double(raw[index + 3]) / 255
                guard alpha > 0.3 else { continue }
                let red = Double(raw[index]) / 255 / alpha
                guard red < 0.35 else { continue }
                dark += 1
                let point = CGPoint(x: Double(x), y: Double(y))
                guard box.contains(point) else { continue }
                let inCornerColumn = point.x < box.minX + corner.width
                    || point.x > box.maxX - corner.width
                let inCornerRow = point.y < box.minY + corner.height
                    || point.y > box.maxY - corner.height
                if inCornerColumn, inCornerRow { darkCorners += 1 }
            }
        }
        return Result(darkPixels: dark, darkCornerPixels: darkCorners)
    }
}
