import AppKit
import Testing
@testable import YapperNative

@MainActor
struct TextOutlineFillTests {
    @Test("An outline preserves the solid letter interiors, including overlapping font contours",
          arguments: TextLayerFont.allCases)
    func outlineDoesNotCutThroughLetters(font: TextLayerFont) throws {
        let plain = try bitmap(font: font, outlined: false)
        let outlined = try bitmap(font: font, outlined: true)
        let dx = (outlined.pixelsWide - plain.pixelsWide) / 2
        let dy = (outlined.pixelsHigh - plain.pixelsHigh) / 2
        var solidPixels = 0
        var damagedPixels = 0
        for y in 0..<plain.pixelsHigh {
            for x in 0..<plain.pixelsWide {
                guard let before = plain.colorAt(x: x, y: y),
                      before.alphaComponent > 0.99,
                      before.redComponent > 0.99 else { continue }
                solidPixels += 1
                let after = try #require(outlined.colorAt(x: x + dx, y: y + dy))
                if after.redComponent < 0.95 || after.alphaComponent < 0.95 {
                    damagedPixels += 1
                }
            }
        }
        #expect(solidPixels > 1_000)
        #expect(damagedPixels < solidPixels / 100,
                "Outline damaged \(damagedPixels) of \(solidPixels) solid fill pixels")
    }

    @Test("Export uses the same heavy system face as the canvas",
          arguments: TextLayerFont.allCases)
    func exportFontMatchesCanvas(font: TextLayerFont) throws {
        let base = NSFont.systemFont(ofSize: 73.728, weight: .heavy)
        let design: NSFontDescriptor.SystemDesign = switch font {
        case .modern: .default
        case .rounded: .rounded
        case .editorial: .serif
        }
        let expected = try #require(NSFont(descriptor: base.fontDescriptor.withDesign(design)!, size: 73.728))
        let actual = TextAppearanceLayer.font(for: font, size: 73.728)
        #expect(actual.fontName == expected.fontName)
    }

    private func bitmap(font: TextLayerFont, outlined: Bool) throws -> NSBitmapImageRep {
        let layer = TextAppearanceLayer.make(
            text: "I'm able to strengthen ahead of surgery",
            appearance: TextAppearance(font: font, fontScale: 0.024,
                                       strokeEnabled: outlined, strokeWidth: 0.019045770877944318,
                                       shadowEnabled: false),
            renderSize: CGSize(width: 1728, height: 3072),
            centerX: 0.5, centerY: 2.0 / 3, maximumWidth: 0.88, maximumHeight: 0.4
        )
        let contents = try #require(layer.sublayers?.first?.contents)
        let image = contents as! CGImage
        return NSBitmapImageRep(cgImage: image)
    }
}
