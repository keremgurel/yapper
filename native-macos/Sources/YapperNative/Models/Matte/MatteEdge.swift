import CoreImage
import Foundation

/// Turning Vision's raw person mask into an edge that survives being
/// composited over something new.
///
/// The mask arrives with a hard, slightly blocky edge that sits a pixel or two
/// outside the person, because the model is drawing a generous outline rather
/// than a cut. Composite that straight over a new background and the old one
/// comes with it, as a bright rim around the shoulders and the top of the head.
/// It reads as a cheap green screen, and it is the single thing that decides
/// whether this effect looks bought or homemade.
///
/// Two passes fix it. Blur the edge so it has somewhere to blend, then pull the
/// midpoint inwards so the blend starts inside the subject instead of outside
/// it. The blur alone would keep the halo and make it softer; the tightening
/// alone would keep the blocking.
enum MatteEdge {
    /// How far the edge is softened, as a fraction of the frame's height. Under
    /// three pixels at 1080p: enough to hide the model's blocking, not so much
    /// that hair turns to fog.
    static let feather = 0.0025

    /// The span of the blurred edge that becomes the visible ramp. Everything
    /// below the floor is background, everything above the ceiling is subject.
    ///
    /// The two do double duty, and the numbers are a balance between them.
    /// Their midpoint sits above half, which is what pulls the cut inside the
    /// person and takes the rim of old background with it. Their distance apart
    /// decides how much of the blur survives: a narrow span would choke the
    /// ramp back into the hard edge the blur was there to remove, so it is kept
    /// wide enough that most of the feather comes through.
    static let floor = 0.42
    static let ceiling = 0.92

    /// The finished mask: white where the person is, black where they are not,
    /// and a short soft ramp between the two.
    ///
    /// - Parameter frameHeight: the height of the picture the mask will be
    ///   applied to, in pixels, which is what the feather is measured against.
    ///   A fixed pixel radius would be a heavy blur on a preview-sized frame
    ///   and invisible at 4K.
    static func finish(_ mask: CIImage, frameHeight: CGFloat) -> CIImage {
        let extent = mask.extent
        guard !extent.isEmpty else { return mask }

        // Clamped first, or the blur pulls transparent black in from beyond the
        // edges and eats a soft border out of the whole mask.
        let blurred = mask
            .clampedToExtent()
            .applyingFilter(
                "CIGaussianBlur",
                parameters: [kCIInputRadiusKey: max(1, frameHeight * feather)]
            )
            .cropped(to: extent)

        // A straight line through the two thresholds, which both moves the edge
        // and keeps its softness: see `floor` and `ceiling`.
        //
        // Each vector is one row of the output, the way `ColorMatrix` builds
        // the grade, so all three colour rows read the red channel and nothing
        // else. That both applies the line and copies the result across the
        // channels: a one-component buffer is not promised to arrive as grey,
        // and a mask that turned out to be red-only would blend nothing.
        let span = max(0.0001, ceiling - floor)
        let gain = 1 / span
        let bias = -floor / span
        return blurred
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
            // The bias makes every pixel opaque, including the ones outside the
            // picture, so Core Image widens the result to infinity. Left that
            // way it spreads: a blend against an endless mask is endless too,
            // and there is no frame to render.
            .cropped(to: extent)
    }
}
