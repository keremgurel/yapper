@preconcurrency import AVFoundation
import CoreGraphics
import CoreImage
import Foundation

/// Finding the blemishes on one frame and handing back a mask covering those
/// and nothing else.
///
/// The work is done on a small copy of the face, a few hundred pixels across.
/// Nothing here needs resolution: a spot worth removing is several pixels
/// across even at that size, and the alternative is labelling five million
/// pixels per frame to learn the same thing.
///
/// Only ever touched from the compositor's own serial queue.
final class BlemishDetector: @unchecked Sendable {
    /// How wide the face is worked on, in pixels.
    static let workingWidth: CGFloat = 320

    /// How far the guided filter reaches to lift the texture off, and how far
    /// away the surrounding skin tone is measured, both as fractions of the
    /// working width.
    static let textureReach = 0.02
    static let regionReach = 0.10

    /// How far the anomaly map is stretched before it is read as bytes. The
    /// interesting range is a few percent of full scale, and a byte has no
    /// resolution to spare down there.
    static let readingGain = 8.0

    /// How far a point has to sit from the skin around it to be a candidate,
    /// after that stretch.
    static let candidateFrom: UInt8 = 40

    /// How brightly lit the skin under a patch has to be, out of 255.
    ///
    /// Measured rather than guessed. Read in linear light, the lit side of a
    /// face in this footage sits between 70 and 108, while hair, the shadow
    /// under a chin and the inside of a nostril sit near zero. An earlier guess
    /// of 110 was above the brightest skin in the frame and rejected every
    /// patch on the face.
    static let litFrom: UInt8 = 62

    /// How far past its own edge a patch is faded, as a fraction of its radius.
    static let feather = 0.6

    /// How far above Vision's box the face is taken to carry on, as a fraction
    /// of that box's height.
    ///
    /// The box stops at the eyebrows. A forehead is the one part of a face most
    /// reliably covered in exactly what this removes, so a detector working
    /// inside the box alone examines everything except the place worth looking.
    /// Measured on this footage: the hairline sits a little over a third of a
    /// box-height above the brow.
    static let foreheadReach = 0.38

    /// How far the working region reaches past the face on every other side, so
    /// a spot on the jaw is not cut in half by the edge of the crop.
    static let margin = 0.06

    /// The whole face including the forehead, which is what everything here is
    /// actually measured against.
    ///
    /// Grown upward and not downward. Growing evenly, which is what this did,
    /// reaches the same distance onto the neck, and a neck under a jaw is a band
    /// of shadow and shaving marks that reads as blemishes all day.
    static func fullFace(_ face: CGRect) -> CGRect {
        CGRect(
            x: face.minX,
            y: face.minY,
            width: face.width,
            height: face.height * (1 + foreheadReach)
        )
    }

    private struct Key: Hashable {
        let trackID: CMPersistentTrackID
        let value: CMTimeValue
        let timescale: CMTimeScale
    }

    private static let cacheLimit = 4
    private var cache: [Key: CIImage?] = [:]
    private var order: [Key] = []

    /// A mask covering the blemishes on this frame, white on black, in the
    /// frame's own pixels. `nil` when there are none.
    func mask(
        for image: CIImage,
        face: CGRect,
        trackID: CMPersistentTrackID,
        at time: CMTime,
        context: CIContext
    ) -> CIImage? {
        let key = Key(trackID: trackID, value: time.value, timescale: time.timescale)
        if let cached = cache[key] { return cached }
        let found = Self.patches(in: image, face: face, context: context)
        let mask = found.isEmpty ? nil : Self.discs(found, in: image.extent)
        store(mask, for: key)
        return mask
    }

    /// Where the blemishes are on this frame, in the frame's own pixels.
    ///
    /// Separate from the mask so it can be measured: a test can ask how many
    /// were found and where, which a rendered mask makes needlessly hard.
    static func patches(
        in image: CIImage,
        face: CGRect,
        context: CIContext
    ) -> [(centre: CGPoint, radius: Double)] {
        let whole = fullFace(face)
        let region = whole
            .insetBy(dx: -whole.width * margin, dy: -whole.height * margin)
            .intersection(image.extent)
        guard region.width > 8, region.height > 8 else { return [] }

        let scale = workingWidth / region.width
        let small = image
            .cropped(to: region)
            .transformed(
                by: CGAffineTransform(translationX: -region.minX, y: -region.minY)
                    .concatenating(CGAffineTransform(scaleX: scale, y: scale))
            )
        let extent = CGRect(
            x: 0,
            y: 0,
            width: (region.width * scale).rounded(.down),
            height: (region.height * scale).rounded(.down)
        )
        guard extent.width > 8, extent.height > 8 else { return [] }

        // The same split the correction uses, at a size where it is cheap: the
        // picture without its texture, and the skin tone around each point.
        guard let base = guided(small, radius: workingWidth * textureReach) else { return [] }
        let surroundings = base
            .clampedToExtent()
            .applyingFilter(
                "CIGaussianBlur",
                parameters: [kCIInputRadiusKey: workingWidth * regionReach]
            )
            .cropped(to: extent)
        // Two readings packed into one picture, so one render answers both
        // questions: how far this point sits from the skin around it, and how
        // brightly lit that skin is.
        //
        // The second matters as much as the first. Every correction here moves
        // a pixel towards its surroundings, and the same step is a nudge on a
        // lit cheek and a glaring disc in a shadow, because light is stored
        // linearly and seen anything but. Rather than try to cap that, nothing
        // is allowed to fire on the dark parts of a face at all.
        let anomaly = base
            .applyingFilter(
                "CIDifferenceBlendMode",
                parameters: [kCIInputBackgroundImageKey: surroundings]
            )
            .applyingFilter(
                "CIColorMatrix",
                parameters: [
                    "inputRVector": CIVector(
                        x: 0.2126 * readingGain,
                        y: 0.7152 * readingGain,
                        z: 0.0722 * readingGain,
                        w: 0
                    ),
                    "inputGVector": CIVector(x: 0, y: 0, z: 0, w: 0),
                    "inputBVector": CIVector(x: 0, y: 0, z: 0, w: 0),
                    "inputAVector": CIVector(x: 0, y: 0, z: 0, w: 0),
                    "inputBiasVector": CIVector(x: 0, y: 0, z: 0, w: 1),
                ]
            )
            .applyingFilter("CIColorClamp")
        let lit = surroundings
            .applyingFilter(
                "CIColorMatrix",
                parameters: [
                    "inputRVector": CIVector(x: 0, y: 0, z: 0, w: 0),
                    "inputGVector": CIVector(x: 0.2126, y: 0.7152, z: 0.0722, w: 0),
                    "inputBVector": CIVector(x: 0, y: 0, z: 0, w: 0),
                    "inputAVector": CIVector(x: 0, y: 0, z: 0, w: 0),
                    "inputBiasVector": CIVector(x: 0, y: 0, z: 0, w: 1),
                ]
            )
        let readings = anomaly
            .applyingFilter(
                "CIAdditionCompositing",
                parameters: [kCIInputBackgroundImageKey: lit]
            )
            .cropped(to: extent)

        let width = Int(extent.width)
        let height = Int(extent.height)
        var bytes = [UInt8](repeating: 0, count: width * height * 4)
        bytes.withUnsafeMutableBytes { raw in
            guard let address = raw.baseAddress else { return }
            // Rendered without colour management, so the numbers that come back
            // are the ones the graph computed rather than a display's idea of
            // them.
            context.render(
                readings,
                toBitmap: address,
                rowBytes: width * 4,
                bounds: extent,
                format: .RGBA8,
                colorSpace: nil
            )
        }
        var map = [UInt8](repeating: 0, count: width * height)
        var brightness = [UInt8](repeating: 0, count: width * height)
        for index in 0 ..< (width * height) {
            map[index] = bytes[index * 4]
            brightness[index] = bytes[index * 4 + 1]
        }

        let blobs = BlemishBlobs.blemishes(
            among: BlemishBlobs.find(
                in: map,
                width: width,
                height: height,
                threshold: candidateFrom
            ),
            faceWidth: Double(face.width * scale)
        )
        .filter { blob in
            // On lit skin, not in the hair, the shadow of a jaw or a nostril.
            let x = Int(blob.centre.x)
            let y = Int(blob.centre.y)
            guard x >= 0, y >= 0, x < width, y < height else { return false }
            return brightness[y * width + x] >= Self.litFrom
        }

        // Back into the frame's own pixels. The map was rendered upside down
        // relative to Core Image, which measures from the bottom.
        return blobs
            .map { blob in
                (
                    CGPoint(
                        x: region.minX + blob.centre.x / scale,
                        y: region.minY + (extent.height - blob.centre.y) / scale
                    ),
                    blob.radius / Double(scale)
                )
            }
            // Only what is actually on the face. The working region reaches
            // past it on purpose, so a spot at the jaw is not cut in half, and
            // that reach picks up the chair behind the speaker's shoulder.
            .filter { isOnTheFace($0.centre, face: face) }
    }

    /// Whether a point falls on the face itself.
    ///
    /// Tighter than the ellipse `RetouchMask.face` draws, which is deliberately
    /// generous so smoothing does not end on a seam. Nothing is being blended
    /// here: a patch either sits on skin or it does not.
    ///
    /// The oval runs chin to hairline, so it reaches the forehead and stops at
    /// the jaw rather than carrying on down the neck.
    static func isOnTheFace(_ point: CGPoint, face: CGRect) -> Bool {
        let whole = fullFace(face)
        guard whole.width > 0, whole.height > 0 else { return false }
        let x = (point.x - whole.midX) / (whole.width / 2)
        let y = (point.y - whole.midY) / (whole.height / 2)
        return x * x + y * y <= 1
    }

    /// One soft disc per blemish, all of them together.
    static func discs(
        _ patches: [(centre: CGPoint, radius: Double)],
        in extent: CGRect
    ) -> CIImage? {
        var mask: CIImage?
        for patch in patches {
            let gradient = CIFilter(name: "CIRadialGradient")
            gradient?.setValue(CIVector(cgPoint: patch.centre), forKey: kCIInputCenterKey)
            gradient?.setValue(patch.radius, forKey: "inputRadius0")
            gradient?.setValue(patch.radius * (1 + feather), forKey: "inputRadius1")
            gradient?.setValue(CIColor.white, forKey: "inputColor0")
            gradient?.setValue(
                CIColor(red: 0, green: 0, blue: 0, alpha: 1),
                forKey: "inputColor1"
            )
            guard let disc = gradient?.outputImage?.cropped(
                to: CGRect(
                    x: patch.centre.x - patch.radius * 2,
                    y: patch.centre.y - patch.radius * 2,
                    width: patch.radius * 4,
                    height: patch.radius * 4
                ).intersection(extent)
            ) else { continue }
            mask = mask.map {
                disc.applyingFilter(
                    "CIMaximumCompositing",
                    parameters: [kCIInputBackgroundImageKey: $0]
                )
            } ?? disc
        }
        guard let mask else { return nil }
        // Over black, so everywhere without a patch reads as leave alone rather
        // than as nothing at all.
        return mask
            .composited(over: CIImage(color: .black).cropped(to: extent))
            .cropped(to: extent)
    }

    private static func guided(_ image: CIImage, radius: CGFloat) -> CIImage? {
        guard let filter = CIFilter(name: "CIGuidedFilter") else { return nil }
        filter.setValue(image, forKey: "inputImage")
        filter.setValue(image, forKey: "inputGuideImage")
        filter.setValue(radius, forKey: "inputRadius")
        filter.setValue(0.0025, forKey: "inputEpsilon")
        return filter.outputImage?.cropped(to: image.extent)
    }

    private func store(_ mask: CIImage?, for key: Key) {
        cache[key] = mask
        order.append(key)
        while order.count > Self.cacheLimit {
            cache.removeValue(forKey: order.removeFirst())
        }
    }
}
