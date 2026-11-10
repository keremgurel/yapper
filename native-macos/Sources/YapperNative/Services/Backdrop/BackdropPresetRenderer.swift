import CoreGraphics
import Foundation

/// Paints a preset into a bitmap once, so the compositor only ever composites
/// a still.
///
/// A preset is a function of the pixel and nothing else, so it is drawn on the
/// CPU here rather than as a Core Image kernel: the math is ordinary Swift, it
/// can be tested, and the same numbers port to the agent skill unchanged. A
/// 1080 by 1920 frame takes a few tens of milliseconds across all cores, and
/// the result is cached by preset, size and focus.
enum BackdropPresetRenderer {
    private static let cache = BackdropImageCache()

    static func image(
        _ preset: BackdropPreset,
        width: Int,
        height: Int,
        focus: (x: Double, y: Double) = (0.5, 0.42)
    ) -> CGImage? {
        guard width > 0, height > 0 else { return nil }
        // Rounded so a card nudged a pixel does not repaint the backdrop.
        let fx = (focus.x * 50).rounded() / 50
        let fy = (focus.y * 50).rounded() / 50
        let key = "\(preset.rawValue)-\(width)x\(height)-\(fx)-\(fy)"
        if let cached = cache.image(for: key) { return cached }

        let shader = BackdropPresetShader(
            preset: preset,
            aspect: Double(width) / Double(height),
            focus: (fx, fy)
        )
        let bytesPerRow = width * 4
        var pixels = [UInt8](repeating: 255, count: bytesPerRow * height)
        let grain = shader.grain
        pixels.withUnsafeMutableBufferPointer { buffer in
            let base = buffer.baseAddress!
            DispatchQueue.concurrentPerform(iterations: height) { y in
                let v = (Double(y) + 0.5) / Double(height)
                let row = base + y * bytesPerRow
                for x in 0 ..< width {
                    let u = (Double(x) + 0.5) / Double(width)
                    let noise = (Shade.hash(x, y) - 0.5) * 2 * grain
                    let c = shader.color(u, v).adding(noise)
                    let p = row + x * 4
                    p[0] = channel(c.r)
                    p[1] = channel(c.g)
                    p[2] = channel(c.b)
                }
            }
        }

        guard
            let space = CGColorSpace(name: CGColorSpace.sRGB),
            let provider = CGDataProvider(data: Data(pixels) as CFData),
            let image = CGImage(
                width: width,
                height: height,
                bitsPerComponent: 8,
                bitsPerPixel: 32,
                bytesPerRow: bytesPerRow,
                space: space,
                bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.noneSkipLast.rawValue),
                provider: provider,
                decode: nil,
                shouldInterpolate: true,
                intent: .defaultIntent
            )
        else { return nil }
        cache.store(image, for: key)
        return image
    }

    private static func channel(_ value: Double) -> UInt8 {
        UInt8(Shade.clamp(value) * 255 + 0.5)
    }
}

/// A small cache of painted backdrops. Thread safe: the composition builder
/// and the inspector's swatches both ask for them.
private final class BackdropImageCache: @unchecked Sendable {
    private let lock = NSLock()
    private var images: [String: CGImage] = [:]
    private var order: [String] = []
    private let limit = 24

    func image(for key: String) -> CGImage? {
        lock.lock()
        defer { lock.unlock() }
        return images[key]
    }

    func store(_ image: CGImage, for key: String) {
        lock.lock()
        defer { lock.unlock() }
        if images[key] == nil { order.append(key) }
        images[key] = image
        while order.count > limit {
            images[order.removeFirst()] = nil
        }
    }
}
