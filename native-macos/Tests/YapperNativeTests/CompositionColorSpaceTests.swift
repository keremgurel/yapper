@preconcurrency import AVFoundation
import Foundation
import CoreImage
import Testing
@testable import YapperNative

/// A composition that states its output colour space renders the same picture
/// whatever else is in it. Left to infer one, AVFoundation reads it off the
/// tracks, and overlay footage is regularly untagged: ProRes 4444 out of a
/// screen recorder carries no primaries, no transfer function and no matrix.
@Suite
struct CompositionColorSpaceTests {
    @Test("An untagged track leaves the output where the take put it")
    func fallsBackToRec709() async {
        #expect(await CompositionColorSpace.tags(of: nil) == .rec709)
    }

    @Test("The composition carries the tags it was given")
    func appliesTags() {
        let composition = AVMutableVideoComposition()
        CompositionColorSpace.apply(.rec709, to: composition)
        #expect(composition.colorPrimaries == AVVideoColorPrimaries_ITU_R_709_2)
        #expect(composition.colorTransferFunction == AVVideoTransferFunction_ITU_R_709_2)
        #expect(composition.colorYCbCrMatrix == AVVideoYCbCrMatrix_ITU_R_709_2)
    }

    @Test("Fresh render buffers encode and report the composition's color space")
    func preparesUntaggedBuffers() throws {
        let composition = AVMutableVideoComposition()
        CompositionColorSpace.apply(.rec709, to: composition)
        var allocated: CVPixelBuffer?
        #expect(CVPixelBufferCreate(
            nil, 16, 16, kCVPixelFormatType_32BGRA,
            [kCVPixelBufferIOSurfacePropertiesKey as String: [:]] as CFDictionary,
            &allocated
        ) == kCVReturnSuccess)
        let buffer = try #require(allocated)
        let space = CompositionColorSpace.prepare(buffer, for: composition)
        let attachments = try #require(CVBufferCopyAttachments(buffer, .shouldPropagate))
            as NSDictionary
        #expect(attachments[kCVImageBufferColorPrimariesKey] as? String == composition.colorPrimaries)
        #expect(attachments[kCVImageBufferTransferFunctionKey] as? String == composition.colorTransferFunction)
        #expect(attachments[kCVImageBufferYCbCrMatrixKey] as? String == composition.colorYCbCrMatrix)

        let frame = CGRect(x: 0, y: 0, width: 16, height: 16)
        let color = try #require(CIColor(
            red: 0.62, green: 0.43, blue: 0.34,
            colorSpace: CGColorSpace(name: CGColorSpace.sRGB)!
        ))
        let image = CIImage(color: color).cropped(to: frame)
        let context = CIContext()
        context.render(image, to: buffer, bounds: frame, colorSpace: space)
        // Read it back using only the published attachments, just as the
        // player does. Encoding and metadata must agree to avoid a gamma shift.
        let decoded = try #require(context.createCGImage(
            CIImage(cvPixelBuffer: buffer), from: frame, format: .RGBA8,
            colorSpace: CGColorSpace(name: CGColorSpace.sRGB)!
        ))
        let pixel = try #require(decoded.sample(x: 8, y: 8))
        #expect(abs(pixel.red - 158) <= 2)
        #expect(abs(pixel.green - 110) <= 2)
        #expect(abs(pixel.blue - 87) <= 2)
    }
}
