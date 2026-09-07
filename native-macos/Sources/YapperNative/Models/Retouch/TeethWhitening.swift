import CoreGraphics
import CoreImage
import Foundation

/// Taking the yellow off teeth.
///
/// The mouth outline is not the same shape as the teeth: it also contains the
/// gap between them, the tongue, and the shadow at the back. Brightening all of
/// that gives someone a glowing mouth rather than a better smile, so the
/// outline is narrowed down to the parts of it that are actually bright before
/// anything is changed.
///
/// What is left gets the two adjustments a dentist's photograph gets: less
/// yellow, and a little more light.
enum TeethWhitening {
    /// How bright a pixel inside the mouth has to be to count as a tooth,
    /// as a fraction of full range. Below the floor is the gap at the back,
    /// above the ceiling is certainly enamel.
    static let toothFrom = 0.22
    static let toothTo = 0.45

    /// How far the two adjustments go at full strength. Small numbers on
    /// purpose: teeth that are whiter than the eyes read as a filter.
    static let saturationDrop = 0.55
    static let brightnessLift = 0.09

    /// The frame with the teeth whitened inside `mouthMask`.
    static func applied(
        to image: CIImage,
        mouthMask: CIImage,
        strength: Double
    ) -> CIImage {
        guard strength > 0 else { return image }
        let extent = image.extent

        // The bright part of the mouth, which is the part made of enamel.
        let span = max(0.0001, toothTo - toothFrom)
        let gain = 1 / span
        let bias = -toothFrom / span
        let enamel = image
            .applyingFilter("CIPhotoEffectMono")
            .applyingFilter(
                "CIColorMatrix",
                parameters: [
                    "inputRVector": CIVector(x: gain, y: 0, z: 0, w: 0),
                    "inputGVector": CIVector(x: gain, y: 0, z: 0, w: 0),
                    "inputBVector": CIVector(x: gain, y: 0, z: 0, w: 0),
                    "inputAVector": CIVector(x: 0, y: 0, z: 0, w: 0),
                    "inputBiasVector": CIVector(x: bias, y: bias, z: bias, w: 1),
                ]
            )
            .applyingFilter("CIColorClamp")
            .cropped(to: extent)

        let mask = enamel
            .applyingFilter(
                "CIMultiplyCompositing",
                parameters: [kCIInputBackgroundImageKey: mouthMask]
            )
            .cropped(to: extent)

        let whitened = image.applyingFilter(
            "CIColorControls",
            parameters: [
                kCIInputSaturationKey: 1 - saturationDrop * strength,
                kCIInputBrightnessKey: brightnessLift * strength,
            ]
        )

        return whitened
            .applyingFilter(
                "CIBlendWithMask",
                parameters: [
                    kCIInputBackgroundImageKey: image,
                    kCIInputMaskImageKey: mask,
                ]
            )
            .cropped(to: extent)
    }
}
