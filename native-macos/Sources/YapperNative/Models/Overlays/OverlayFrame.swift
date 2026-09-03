import CoreGraphics
import Foundation

/// Where an overlay sits on the frame.
///
/// An overlay's `x`, `y`, `width` and `height` are fractions of the rendered
/// frame, measured from its top left corner. Three renderers read them: the
/// SwiftUI canvas over the player, the Core Animation layer that burns images
/// into an export, and the video track that composites a cutaway. They all ask
/// this type, so what a creator places is what the export delivers.
enum OverlayFrame {
    /// The overlay's box in pixels, origin at the top left, y growing down.
    static func box(_ overlay: ProjectOverlay, in size: CGSize) -> CGRect {
        CGRect(
            x: size.width * overlay.x,
            y: size.height * overlay.y,
            width: size.width * overlay.width,
            height: size.height * overlay.height
        )
    }

    /// The box shrunk onto the media's own shape and centred inside it, which
    /// is what actually gets drawn. A box that already matches the media's
    /// aspect comes back unchanged.
    static func fitted(_ box: CGRect, mediaAspect: Double) -> CGRect {
        guard box.width > 0, box.height > 0, mediaAspect > 0 else { return box }
        let boxAspect = Double(box.width / box.height)
        if mediaAspect > boxAspect {
            let height = box.width / mediaAspect
            return CGRect(
                x: box.minX,
                y: box.midY - height / 2,
                width: box.width,
                height: height
            )
        }
        let width = box.height * mediaAspect
        return CGRect(
            x: box.midX - width / 2,
            y: box.minY,
            width: width,
            height: box.height
        )
    }

    /// The shape of what an overlay actually shows: the media's own aspect,
    /// narrowed by whatever the crop kept. Everything that sizes an overlay
    /// asks this rather than the media, so a cropped overlay's box hugs the
    /// picture instead of letterboxing it.
    static func shownAspect(mediaAspect: Double, crop: OverlayCrop) -> Double {
        guard crop.height > 0 else { return mediaAspect }
        return mediaAspect * (crop.width / crop.height)
    }

    /// The fraction of the frame's height that gives `width` the media's own
    /// shape. Width and height are fractions of different edges, so the frame's
    /// aspect has to come into it.
    static func height(
        forWidth width: Double,
        mediaAspect: Double,
        frameAspect: Double
    ) -> Double {
        guard mediaAspect > 0, frameAspect > 0 else { return width }
        return width * frameAspect / mediaAspect
    }

    /// The corner radius an overlay is drawn with, in pixels. Small enough to
    /// read as a card rather than a bubble at any frame size.
    static func cornerRadius(in size: CGSize) -> CGFloat {
        min(size.width, size.height) * 0.018
    }

    /// True when an overlay covers the frame. Something cut to the full frame
    /// is a graphic laid over the picture rather than a card sitting on it, so
    /// it is drawn square-cornered and without a shadow.
    static func isFullFrame(_ overlay: ProjectOverlay) -> Bool {
        overlay.width >= 0.98 && overlay.height >= 0.98
            && overlay.x <= 0.02 && overlay.y <= 0.02
    }

    /// How close two aspects have to be to count as the same shape.
    private static let aspectTolerance = 0.04

    /// The box a freshly added overlay gets.
    ///
    /// Media cut to the frame's own shape is what a creator exports from a
    /// design tool to lay over the whole video, so it fills the frame. Anything
    /// else becomes a card in the top right corner, already on the media's own
    /// shape so nothing is letterboxed inside it, and never so tall that it
    /// covers the speaker.
    /// - Parameter allowFullFrame: false for a generated scene, whose shape is
    ///   the card it was designed for and never a licence to cover the video.
    static func introduced(
        mediaAspect: Double,
        frameAspect: Double,
        allowFullFrame: Bool = true
    ) -> (x: Double, y: Double, width: Double, height: Double) {
        if allowFullFrame, frameAspect > 0,
           abs(mediaAspect - frameAspect) / frameAspect <= aspectTolerance
        {
            return (x: 0, y: 0, width: 1, height: 1)
        }
        let margin = 0.05
        var width = 0.42
        var height = self.height(
            forWidth: width,
            mediaAspect: mediaAspect,
            frameAspect: frameAspect
        )
        let maximumHeight = 0.46
        if height > maximumHeight {
            width *= maximumHeight / height
            height = maximumHeight
        }
        return (
            x: max(0, 1 - width - margin),
            y: margin + 0.02,
            width: width,
            height: height
        )
    }
}
