import CoreImage
import Foundation

/// The speaker's own picture, pushed back: enlarged, blurred and a little
/// darker, filling the frame behind a card.
///
/// The numbers are the ones the TEF ads were cut with by hand in ffmpeg
/// (`scale=1840:-1, gblur=sigma=46, crop, eq=brightness=-0.07:saturation=0.9`
/// on a 1080-wide frame), expressed as fractions of the frame so they hold at
/// any export size.
enum FrostedBackdrop {
    /// How much larger than the frame the picture is drawn before blurring,
    /// so the blur's soft edge falls outside the frame.
    static let zoom: CGFloat = 1.5
    /// Blur radius as a fraction of the frame's width.
    static let blur: CGFloat = 0.025
    static let brightness: Double = -0.07
    static let saturation: Double = 0.9

    /// The frosted version of `placed`, which is the speaker's frame already
    /// put where it sits in the finished picture. Returns exactly `frame`.
    static func frosted(_ placed: CIImage, frame: CGRect) -> CIImage {
        // Worked at a quarter size: a wide blur at full resolution costs many
        // times as much and looks the same once it is this soft.
        let working: CGFloat = 0.25
        let small = placed
            .clampedToExtent()
            .transformed(by: about(frame, scale: zoom * working))
            .applyingGaussianBlur(sigma: Double(frame.width * blur * working))
        return small
            .transformed(by: about(frame, scale: 1 / working))
            .applyingFilter("CIColorControls", parameters: [
                kCIInputBrightnessKey: brightness,
                kCIInputSaturationKey: saturation,
                kCIInputContrastKey: 1.0,
            ])
            .cropped(to: frame)
    }

    /// A scale about the middle of the frame.
    private static func about(_ frame: CGRect, scale: CGFloat) -> CGAffineTransform {
        CGAffineTransform(translationX: frame.midX, y: frame.midY)
            .scaledBy(x: scale, y: scale)
            .translatedBy(x: -frame.midX, y: -frame.midY)
    }
}
