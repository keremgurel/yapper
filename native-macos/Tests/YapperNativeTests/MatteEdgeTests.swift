import CoreGraphics
import CoreImage
import CoreVideo
import Foundation
import Testing
@testable import YapperNative

/// The edge treatment is the difference between a cut-out that looks bought and
/// one that looks homemade, and it is pure arithmetic on a mask, so it can be
/// checked without a camera or a person in front of one.
///
/// The mask is built as the single-channel buffer Vision actually returns, and
/// rendered without colour management, so what these tests measure is the
/// arithmetic rather than a gamma curve applied on the way out.
struct MatteEdgeTests {
    /// A real delivery size. The feather is a fraction of the frame, so a
    /// toy-sized mask would round it down to nothing and the softness these
    /// tests are here to protect would not show up at all.
    private static let size = 1080

    /// A mask split down the middle: background on the left, subject on the
    /// right, with the hard edge Vision hands over.
    private static func splitMask() -> CIImage {
        var buffer: CVPixelBuffer?
        CVPixelBufferCreate(
            nil,
            size,
            size,
            kCVPixelFormatType_OneComponent8,
            nil,
            &buffer
        )
        let mask = buffer!
        CVPixelBufferLockBaseAddress(mask, [])
        let bytes = CVPixelBufferGetBaseAddress(mask)!.assumingMemoryBound(to: UInt8.self)
        let stride = CVPixelBufferGetBytesPerRow(mask)
        for row in 0 ..< size {
            for column in 0 ..< size {
                bytes[row * stride + column] = column < size / 2 ? 0 : 255
            }
        }
        CVPixelBufferUnlockBaseAddress(mask, [])
        return CIImage(cvPixelBuffer: mask)
    }

    private static func finished() -> CGImage {
        let mask = MatteEdge.finish(splitMask(), frameHeight: CGFloat(size))
        return CIContext(options: [.workingColorSpace: NSNull()])
            .createCGImage(mask, from: mask.extent, format: .RGBA8, colorSpace: nil)!
    }

    @Test("The inside of the subject survives the edge treatment untouched")
    func theSubjectStaysOpaque() {
        #expect(Self.finished().sample(x: Self.size - 20, y: Self.size / 2)?.red == 255)
    }

    @Test("The background stays fully out")
    func theBackgroundStaysBlack() {
        #expect(Self.finished().sample(x: 20, y: Self.size / 2)?.red == 0)
    }

    /// The point of the tightening pass. Vision draws its outline around the
    /// person rather than on them, so the halfway point of the mask has to come
    /// out mostly background, or the old backdrop shows as a rim on the
    /// shoulders.
    @Test("The cut lands inside the subject rather than on Vision's outline")
    func theEdgeIsPulledInwards() throws {
        let onTheOldEdge = try #require(
            Self.finished().sample(x: Self.size / 2, y: Self.size / 2)?.red
        )
        #expect(onTheOldEdge < 128)
    }

    /// A hard edge composited over a new background aliases badly, and the
    /// levels pass that moves the edge can just as easily choke the softness
    /// back out of it. Several pixels across the join have to be partly
    /// transparent for the blend to have anywhere to happen.
    @Test("The edge stays soft enough to blend")
    func theEdgeIsFeathered() {
        let frame = Self.finished()
        let soft = (0 ..< Self.size).count {
            guard let value = frame.sample(x: $0, y: Self.size / 2)?.red else { return false }
            return value > 0 && value < 255
        }
        #expect(soft >= 3)
    }

    /// The feather is a fraction of the frame, not a pixel count, so the same
    /// mask cut for a taller frame blends across proportionally more of it.
    @Test("The feather scales with the frame it is cut for")
    func theFeatherScalesWithTheFrame() {
        func softPixels(frameHeight: CGFloat) -> Int {
            let mask = MatteEdge.finish(Self.splitMask(), frameHeight: frameHeight)
            let frame = CIContext(options: [.workingColorSpace: NSNull()])
                .createCGImage(mask, from: mask.extent, format: .RGBA8, colorSpace: nil)!
            return (0 ..< Self.size).count {
                guard let value = frame.sample(x: $0, y: Self.size / 2)?.red else { return false }
                return value > 0 && value < 255
            }
        }
        #expect(softPixels(frameHeight: 2160) > softPixels(frameHeight: 540))
    }
}
