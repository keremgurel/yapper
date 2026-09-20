import AppKit
import ImageIO
import Testing
@testable import YapperNative

struct SDRStillImageTests {
    @Test("SDR decoding preserves transparency and applies EXIF rotation")
    func preservesImageGeometryAndAlpha() throws {
        let url = FileManager.default.temporaryDirectory.appending(path: "\(UUID()).png")
        defer { try? FileManager.default.removeItem(at: url) }
        let context = try #require(CGContext(data: nil, width: 40, height: 20,
            bitsPerComponent: 8, bytesPerRow: 0,
            space: CGColorSpace(name: CGColorSpace.displayP3)!,
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue))
        context.setFillColor(CGColor(red: 1, green: 0, blue: 0, alpha: 0.5))
        context.fill(CGRect(x: 0, y: 0, width: 20, height: 20))
        context.setFillColor(CGColor(red: 0, green: 0, blue: 1, alpha: 1))
        context.fill(CGRect(x: 20, y: 0, width: 20, height: 20))
        let source = try #require(context.makeImage())
        let destination = try #require(CGImageDestinationCreateWithURL(url as CFURL, "public.png" as CFString, 1, nil))
        CGImageDestinationAddImage(destination, source, [kCGImagePropertyOrientation: 6] as CFDictionary)
        #expect(CGImageDestinationFinalize(destination))
        let image = try #require(SDRStillImage.load(url))
        #expect(image.width == 20)
        #expect(image.height == 40)
        #expect(image.bitsPerComponent == 8)
        #expect(image.colorSpace?.name == CGColorSpace.sRGB)
        let bitmap = NSBitmapImageRep(cgImage: image)
        let top = try #require(bitmap.colorAt(x: 10, y: 5))
        let bottom = try #require(bitmap.colorAt(x: 10, y: 35))
        #expect(top.redComponent > 0.9)
        #expect(abs(top.alphaComponent - 0.5) < 0.02)
        #expect(bottom.blueComponent > 0.9)
        #expect(bottom.alphaComponent > 0.99)
    }
}
