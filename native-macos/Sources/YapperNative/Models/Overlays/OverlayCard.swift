import CoreImage
import CoreGraphics
import Foundation

/// The rounding and shadow that make a still read as a card sitting on the
/// picture rather than a rectangle pasted onto it.
///
/// Measured in finished-frame pixels, because that is where it is drawn: the
/// same radius on a small screenshot and a large one, exactly as Core Animation
/// applies it to a layer.
struct OverlayCardStyle: Equatable, Sendable {
    var cornerRadius: CGFloat
    var shadowOpacity: CGFloat
    var shadowRadius: CGFloat
    /// How far the shadow falls, in pixels, downwards in the finished frame.
    var shadowOffset: CGFloat

    /// What a card looks like everywhere else in the editor. The numbers are
    /// the ones the Core Animation pass burns into an export, so a card that
    /// moves onto the compositor keeps the look it already had.
    static func standard(cornerRadius: CGFloat) -> OverlayCardStyle {
        OverlayCardStyle(
            cornerRadius: cornerRadius,
            shadowOpacity: 0.28,
            shadowRadius: 12,
            shadowOffset: 4
        )
    }
}

/// Drawing that card in Core Image.
enum OverlayCard {
    /// The card, rounded and with its shadow beneath it, ready to composite.
    ///
    /// The image is expected to be where it will finally sit, so its extent is
    /// the card's box.
    static func drawn(_ image: CIImage, style: OverlayCardStyle) -> CIImage {
        let box = image.extent
        guard box.width > 1, box.height > 1 else { return image }

        let radius = min(style.cornerRadius, min(box.width, box.height) / 2)
        let rounded = radius > 0 ? clipped(image, to: box, radius: radius) : image
        guard style.shadowOpacity > 0, style.shadowRadius > 0 else { return rounded }
        return rounded.composited(over: shadow(under: rounded, style: style))
    }

    /// The card with its corners taken off.
    ///
    /// `CISourceInCompositing` keeps the picture only where the rounded
    /// rectangle is opaque, which is a clip rather than a blend, so the corners
    /// come away cleanly instead of fading.
    private static func clipped(
        _ image: CIImage,
        to box: CGRect,
        radius: CGFloat
    ) -> CIImage {
        image.applyingFilter(
            "CISourceInCompositing",
            parameters: [kCIInputBackgroundImageKey: mask(box: box, radius: radius)]
        )
    }

    /// A soft dark copy of the card, offset downwards.
    ///
    /// Taken from the card's own transparency rather than from the box it sits
    /// in, which is the whole difference between a shadow and a dark rectangle.
    /// Plenty of overlays are a graphic on a transparent field: a pill, a
    /// badge, a card with a glow around it. A shadow shaped like the box would
    /// show straight through everywhere the picture is empty, and shade a third
    /// of the frame to make a pill look raised.
    ///
    /// Core Animation, which draws these on any project not cutting the speaker
    /// out, takes its shadow from the layer's contents for the same reason.
    /// These two have to agree or turning the switch on would restyle the card.
    private static func shadow(under card: CIImage, style: OverlayCardStyle) -> CIImage {
        card
            .applyingFilter(
                "CIColorMatrix",
                parameters: [
                    // Black, at the card's own transparency scaled down. Each
                    // vector is a row of the output, so alpha comes from alpha.
                    "inputRVector": CIVector(x: 0, y: 0, z: 0, w: 0),
                    "inputGVector": CIVector(x: 0, y: 0, z: 0, w: 0),
                    "inputBVector": CIVector(x: 0, y: 0, z: 0, w: 0),
                    "inputAVector": CIVector(x: 0, y: 0, z: 0, w: style.shadowOpacity),
                    "inputBiasVector": CIVector(x: 0, y: 0, z: 0, w: 0),
                ]
            )
            // Deliberately not clamped first, unlike the matte: a shadow is
            // supposed to fade into nothing at its edges, and clamping would
            // smear the outermost pixels out forever instead.
            .applyingFilter(
                "CIGaussianBlur",
                parameters: [kCIInputRadiusKey: style.shadowRadius]
            )
            // Core Image measures upwards, so a shadow that falls downwards in
            // the finished frame moves the other way here.
            .transformed(by: CGAffineTransform(translationX: 0, y: -style.shadowOffset))
    }

    /// A white rounded rectangle filling `box`.
    private static func mask(box: CGRect, radius: CGFloat) -> CIImage {
        let generator = CIFilter(name: "CIRoundedRectangleGenerator")
        generator?.setValue(CIVector(cgRect: box), forKey: "inputExtent")
        generator?.setValue(radius, forKey: kCIInputRadiusKey)
        generator?.setValue(CIColor.white, forKey: kCIInputColorKey)
        guard let output = generator?.outputImage else {
            // Older systems without the generator get square corners rather
            // than no card at all.
            return CIImage(color: .white).cropped(to: box)
        }
        return output.cropped(to: box)
    }
}
