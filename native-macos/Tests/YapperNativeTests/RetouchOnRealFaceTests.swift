@preconcurrency import AVFoundation
import CoreGraphics
import CoreImage
import Foundation
import Testing
import Vision
@testable import YapperNative

/// Retouching, measured on an actual face, at several moments of it.
///
/// Synthetic fixtures check the arithmetic and cannot check the look. Five
/// versions of this passed every one of them while marking a real face, so what
/// these do instead is hold the filter to the two promises it is sold on: the
/// spots go, and no pixel is ever moved far enough to be seen as a mark.
///
/// Several moments rather than one, because the version before this looked
/// perfect at twelve seconds and put orange discs across the forehead at twenty.
@Suite(.serialized)
struct RetouchOnRealFaceTests {
    private static let reference = URL(
        filePath: "/Volumes/G MicroSD/DCIM/DJI_001/DJI_20260809170748_0344_D.MP4"
    )

    private static var isMounted: Bool {
        FileManager.default.fileExists(atPath: reference.path)
    }

    private struct Subject {
        let image: CIImage
        let bounds: CGRect
        let seconds: Double
    }

    private static func subject(at seconds: Double) throws -> Subject? {
        let generator = AVAssetImageGenerator(asset: AVURLAsset(url: reference))
        generator.appliesPreferredTrackTransform = true
        generator.requestedTimeToleranceBefore = .zero
        generator.requestedTimeToleranceAfter = .zero
        let cg = try generator.copyCGImage(
            at: CMTime(seconds: seconds, preferredTimescale: 600),
            actualTime: nil
        )
        let image = CIImage(cgImage: cg)
        let request = VNDetectFaceLandmarksRequest()
        try VNImageRequestHandler(cgImage: cg, options: [:]).perform([request])
        guard let face = request.results?.max(by: {
            $0.boundingBox.width * $0.boundingBox.height
                < $1.boundingBox.width * $1.boundingBox.height
        }) else { return nil }
        return Subject(
            image: image,
            bounds: CGRect(
                x: face.boundingBox.minX * image.extent.width,
                y: face.boundingBox.minY * image.extent.height,
                width: face.boundingBox.width * image.extent.width,
                height: face.boundingBox.height * image.extent.height
            ),
            seconds: seconds
        )
    }

    /// The moments checked. Four is not thorough, and it is four more than the
    /// one that let the forehead discs through.
    private static let moments: [Double] = [4, 12, 20, 28, 36]

    private static func cleared(_ subject: Subject, context: CIContext) -> CIImage {
        let patches = BlemishDetector.patches(
            in: subject.image,
            face: subject.bounds,
            context: context
        )
        guard let mask = BlemishDetector.discs(patches, in: subject.image.extent)
        else { return subject.image }
        return BlemishSmoothing.applied(
            to: subject.image,
            patches: mask,
            faceWidth: subject.bounds.width,
            strength: 1
        )
    }

    /// The most any pixel moves, and how many move at all.
    private static func damage(_ subject: Subject, context: CIContext) -> (worst: Int, touched: Int) {
        let extent = subject.image.extent
        let before = context.createCGImage(subject.image, from: extent)!
        let after = context.createCGImage(cleared(subject, context: context), from: extent)!
        var worst = 0
        var touched = 0
        for y in stride(from: 0, to: before.height, by: 3) {
            for x in stride(from: 0, to: before.width, by: 3) {
                guard let a = before.sample(x: x, y: y), let b = after.sample(x: x, y: y)
                else { continue }
                let moved = max(
                    abs(a.red - b.red),
                    max(abs(a.green - b.green), abs(a.blue - b.blue))
                )
                if moved > 1 { touched += 1 }
                worst = max(worst, moved)
            }
        }
        return (worst, touched)
    }

    /// The one that matters. A blemish is worth a few levels; anything that
    /// moves a pixel far is a disc painted onto a face, which is what every
    /// version that computed a signed correction eventually did.
    @Test("No pixel is ever moved far enough to be seen as a mark", .enabled(if: isMounted))
    func nothingIsEverMarked() throws {
        let context = CIContext()
        for seconds in Self.moments {
            guard let subject = try Self.subject(at: seconds) else { continue }
            let damage = Self.damage(subject, context: context)
            #expect(
                damage.worst < 45,
                "a pixel moved \(damage.worst) levels at \(Int(seconds))s"
            )
        }
    }

    @Test("Spots are found, and not half the face with them", .enabled(if: isMounted))
    func spotsAreFound() throws {
        let context = CIContext()
        var found = 0
        for seconds in Self.moments {
            guard let subject = try Self.subject(at: seconds) else { continue }
            let patches = BlemishDetector.patches(
                in: subject.image,
                face: subject.bounds,
                context: context
            )
            found += patches.count
            // A face has spots, not scores of them. Dozens means the detector
            // has started reading skin as blemish.
            #expect(patches.count < 30, "\(patches.count) patches at \(Int(seconds))s")
            #expect(
                patches.allSatisfy {
                    BlemishDetector.isOnTheFace($0.centre, face: subject.bounds)
                },
                "a patch landed off the face at \(Int(seconds))s"
            )
        }
        #expect(found > 0)
    }

    /// Whatever the detector gets wrong, it cannot get it wrong anywhere it was
    /// not pointed.
    @Test("Almost none of the picture changes at all", .enabled(if: isMounted))
    func changesAreConfined() throws {
        let context = CIContext()
        for seconds in Self.moments {
            guard let subject = try Self.subject(at: seconds) else { continue }
            let damage = Self.damage(subject, context: context)
            let sampled = (subject.image.extent.width / 3) * (subject.image.extent.height / 3)
            #expect(Double(damage.touched) / Double(sampled) < 0.01)
        }
    }

    /// A wall is not skin, and neither is the chair behind the speaker.
    @Test("The room behind the speaker is untouched", .enabled(if: isMounted))
    func theRoomIsUntouched() throws {
        let context = CIContext()
        guard let subject = try Self.subject(at: 12) else { return }
        let extent = subject.image.extent
        let before = context.createCGImage(subject.image, from: extent)!
        let after = context.createCGImage(Self.cleared(subject, context: context), from: extent)!
        for y in stride(from: 20, to: 320, by: 11) {
            for x in stride(from: 20, to: 320, by: 11) {
                guard let a = before.sample(x: x, y: y), let b = after.sample(x: x, y: y)
                else { continue }
                #expect(a.red == b.red)
                #expect(a.green == b.green)
            }
        }
    }
}
