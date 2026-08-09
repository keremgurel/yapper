@preconcurrency import AVFoundation
import CoreGraphics
import Foundation
@testable import YapperNative

/// A solid-colour movie written to disk, so a test can check where a picture
/// lands in the frame without needing a camera file on a mounted drive.
enum SyntheticVideo {
    /// A movie split down the middle, so a test can tell which half of the
    /// picture survived a crop.
    static func writeSplit(
        left: CGColor,
        right: CGColor,
        size: CGSize,
        seconds: Double = 1,
        to url: URL
    ) async throws {
        try await write(color: left, rightHalf: right, size: size, seconds: seconds, to: url)
    }

    static func write(
        color: CGColor,
        rightHalf: CGColor? = nil,
        size: CGSize,
        seconds: Double = 1,
        to url: URL
    ) async throws {
        try? FileManager.default.removeItem(at: url)
        let writer = try AVAssetWriter(outputURL: url, fileType: .mov)
        let input = AVAssetWriterInput(
            mediaType: .video,
            outputSettings: [
                AVVideoCodecKey: AVVideoCodecType.h264,
                AVVideoWidthKey: Int(size.width),
                AVVideoHeightKey: Int(size.height),
            ]
        )
        input.expectsMediaDataInRealTime = false
        let adaptor = AVAssetWriterInputPixelBufferAdaptor(
            assetWriterInput: input,
            sourcePixelBufferAttributes: [
                kCVPixelBufferPixelFormatTypeKey as String: Int(kCVPixelFormatType_32ARGB),
                kCVPixelBufferWidthKey as String: Int(size.width),
                kCVPixelBufferHeightKey as String: Int(size.height),
            ]
        )
        writer.add(input)
        writer.startWriting()
        writer.startSession(atSourceTime: .zero)

        let frameRate = 30
        let frames = max(1, Int(seconds * Double(frameRate)))
        for frame in 0 ..< frames {
            while !input.isReadyForMoreMediaData {
                try await Task.sleep(for: .milliseconds(5))
            }
            guard
                let pool = adaptor.pixelBufferPool,
                let buffer = filled(color: color, rightHalf: rightHalf, size: size, pool: pool)
            else {
                throw NativeEditorError.exportFailed("Could not make a test frame.")
            }
            adaptor.append(
                buffer,
                withPresentationTime: CMTime(value: CMTimeValue(frame), timescale: CMTimeScale(frameRate))
            )
        }

        input.markAsFinished()
        await writer.finishWriting()
        if writer.status != .completed {
            throw NativeEditorError.exportFailed(
                writer.error?.localizedDescription ?? "The test movie was not written."
            )
        }
    }

    private static func filled(
        color: CGColor,
        rightHalf: CGColor?,
        size: CGSize,
        pool: CVPixelBufferPool
    ) -> CVPixelBuffer? {
        var buffer: CVPixelBuffer?
        guard
            CVPixelBufferPoolCreatePixelBuffer(nil, pool, &buffer) == kCVReturnSuccess,
            let buffer
        else { return nil }

        CVPixelBufferLockBaseAddress(buffer, [])
        defer { CVPixelBufferUnlockBaseAddress(buffer, []) }
        guard
            let context = CGContext(
                data: CVPixelBufferGetBaseAddress(buffer),
                width: CVPixelBufferGetWidth(buffer),
                height: CVPixelBufferGetHeight(buffer),
                bitsPerComponent: 8,
                bytesPerRow: CVPixelBufferGetBytesPerRow(buffer),
                space: CGColorSpaceCreateDeviceRGB(),
                bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue
            )
        else { return nil }
        context.setFillColor(color)
        context.fill(CGRect(origin: .zero, size: size))
        if let rightHalf {
            context.setFillColor(rightHalf)
            context.fill(
                CGRect(x: size.width / 2, y: 0, width: size.width / 2, height: size.height)
            )
        }
        return buffer
    }
}

/// One pixel of a rendered frame, as plain numbers a test can compare.
struct SampledPixel {
    let red: Int
    let green: Int
    let blue: Int

    var isMostlyRed: Bool { red > blue + 40 && red > green + 40 }
    var isMostlyBlue: Bool { blue > red + 40 && blue > green + 40 }
}

extension CGImage {
    /// The pixel at a point, with the origin at the top left, the way a frame
    /// is described everywhere else in the editor.
    ///
    /// A rendered frame comes back as 32 bits per pixel in whatever order the
    /// renderer felt like: AVFoundation hands over little-endian BGRA, a bitmap
    /// drawn by hand is usually big-endian ARGB. Both say so in `bitmapInfo`,
    /// so the offsets are worked out rather than assumed.
    func sample(x: Int, y: Int) -> SampledPixel? {
        guard
            let data = dataProvider?.data,
            let bytes = CFDataGetBytePtr(data),
            x >= 0, y >= 0, x < width, y < height
        else { return nil }
        let pixel = y * bytesPerRow + x * (bitsPerPixel / 8)
        let alphaFirst = alphaInfo == .premultipliedFirst
            || alphaInfo == .first
            || alphaInfo == .noneSkipFirst
        let isLittleEndian = bitmapInfo.intersection(.byteOrderMask) == .byteOrder32Little

        // Offsets of red, green and blue within the pixel.
        let offsets: (red: Int, green: Int, blue: Int)
        switch (isLittleEndian, alphaFirst) {
        case (false, true): offsets = (1, 2, 3)      // ARGB
        case (false, false): offsets = (0, 1, 2)     // RGBA
        case (true, true): offsets = (2, 1, 0)       // BGRA
        case (true, false): offsets = (3, 2, 1)      // ABGR
        }
        return SampledPixel(
            red: Int(bytes[pixel + offsets.red]),
            green: Int(bytes[pixel + offsets.green]),
            blue: Int(bytes[pixel + offsets.blue])
        )
    }
}
