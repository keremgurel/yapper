import CoreImage
import ImageIO

/// Decode the photo's standard-range representation before giving it to the
/// video renderer. NSImage may choose a gain-map-expanded HDR/PQ bitmap, which
/// Core Animation burns into SDR video with washed-out colors.
enum SDRStillImage {
    private static let context = CIContext()
    private static let colorSpace = CGColorSpace(name: CGColorSpace.sRGB)!

    static func load(_ url: URL) -> CGImage? {
        guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
              let decoded = CGImageSourceCreateImageAtIndex(source, 0, [
                kCGImageSourceDecodeRequest: kCGImageSourceDecodeToSDR,
                kCGImageSourceShouldCacheImmediately: true,
              ] as CFDictionary) else { return nil }
        let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any]
        let orientation = (properties?[kCGImagePropertyOrientation] as? NSNumber)?.int32Value ?? 1
        let image = CIImage(cgImage: decoded).oriented(forExifOrientation: orientation)
        // Bake the input ICC profile into an ordinary 8-bit sRGB bitmap. This
        // also preserves alpha and applies EXIF orientation, as NSImage did.
        return context.createCGImage(image, from: image.extent, format: .RGBA8, colorSpace: colorSpace)
    }
}
