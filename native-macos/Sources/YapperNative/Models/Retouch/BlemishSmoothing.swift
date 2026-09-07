import CoreGraphics
import CoreImage
import Foundation

/// Settling a blemish into the skin around it, and touching nothing else.
///
/// Inside a patch the picture is mixed towards the colour of the skin around
/// that patch. Outside one, nothing happens at all.
///
/// That is the whole of it, and the simplicity is the point. Five earlier
/// versions worked the blemish out as a signed correction and added it back:
/// subtract where the spot was light, add where it was dark. Every one of them
/// eventually painted a bright disc onto a face, and the reason turned out to
/// have nothing to do with the correction. Core Image's blends clamp their
/// results into nought to one, camera footage carries values outside it, and a
/// highlight comes back from the very first blend flattened to white however
/// small the correction was. The arithmetic was never the problem; doing
/// arithmetic at all was.
///
/// Mixing cannot do that. The skin tone being mixed towards is a blurred copy
/// of the picture, so it holds only values the picture already had, and a mix
/// of two values sits between them. There is no arrangement of inputs that
/// makes this brighter than the face it is working on.
///
/// What it costs is the texture inside a patch, which goes with the spot.
/// Across a disc the size of a blemish that reads as healing rather than
/// blurring, and it is the honest trade: no version of this kept pores inside
/// the patch anyway, and the ones that claimed to were the ones leaving marks.
enum BlemishSmoothing {
    /// How far away the skin tone being mixed towards is measured, as a
    /// fraction of the face's width.
    ///
    /// Wide enough to have averaged the spot away, narrow enough that it is
    /// still the skin beside it rather than the whole cheek.
    static let regionReach = 0.035

    /// The frame with the blemishes in `patches` settled into the skin.
    ///
    /// - Parameters:
    ///   - patches: where the blemishes are, white on black. Everywhere this is
    ///     black the frame is returned exactly as it came in.
    ///   - faceWidth: how wide the face is in this frame's pixels, which the
    ///     reach is measured against.
    ///   - strength: nothing to full.
    static func applied(
        to image: CIImage,
        patches: CIImage,
        faceWidth: CGFloat,
        strength: Double
    ) -> CIImage {
        guard strength > 0, faceWidth > 1 else { return image }
        let extent = image.extent

        let skinTone = image
            .clampedToExtent()
            .applyingFilter(
                "CIGaussianBlur",
                parameters: [kCIInputRadiusKey: max(1, faceWidth * regionReach)]
            )
            .cropped(to: extent)

        let allowed = patches
            .applyingFilter(
                "CIColorMatrix",
                parameters: [
                    "inputRVector": CIVector(x: strength, y: 0, z: 0, w: 0),
                    "inputGVector": CIVector(x: strength, y: 0, z: 0, w: 0),
                    "inputBVector": CIVector(x: strength, y: 0, z: 0, w: 0),
                    "inputAVector": CIVector(x: 0, y: 0, z: 0, w: 0),
                    "inputBiasVector": CIVector(x: 0, y: 0, z: 0, w: 1),
                ]
            )
            .cropped(to: extent)

        return skinTone
            .applyingFilter(
                "CIBlendWithMask",
                parameters: [
                    kCIInputBackgroundImageKey: image,
                    kCIInputMaskImageKey: allowed,
                ]
            )
            .cropped(to: extent)
    }
}
