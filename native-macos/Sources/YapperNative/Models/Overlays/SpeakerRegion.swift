import CoreGraphics
import Foundation

/// A part of the frame the speaker occupies, which an overlay should try to
/// stay off.
///
/// `rect` is in fractions of the rendered frame, measured from its top left,
/// the same space `OverlayFrame` and `OverlayCanvasGeometry` work in.
struct SpeakerRegion: Equatable, Sendable {
    let rect: CGRect
    /// What it costs to cover this. A face is 1: covering it entirely is the
    /// worst thing a placement can do. Anything lower is a preference the
    /// solver will trade away rather than shrink an overlay to nothing.
    let weight: Double
}

/// Where the speaker was at one moment of the finished video.
///
/// A handful of these describe the whole shot well enough for the model to
/// choose boxes that clear the speaker, without sending it a single frame.
struct SpeakerSample: Equatable, Sendable {
    /// Seconds into the timeline, not into the source footage.
    let at: Double
    /// Fractions of the rendered frame, origin top left.
    let rect: CGRect
}

/// Turning detected faces into the parts of the frame a cutaway should avoid.
///
/// Pure arithmetic on fractions. Detection lives in `FaceDetectionService` and
/// the timeline side in `EditorSession+SpeakerRegions`; everything here is
/// testable without a video.
enum SpeakerRegions {
    /// Covering the speaker's face.
    static let faceWeight = 1.0
    /// Sitting on their shoulders. Worse than empty background, better than
    /// shrinking a card until nobody can read it.
    ///
    /// Kept low, and over a small region, on purpose. A heavy no-go area under
    /// the chin does not send a card somewhere better, it sends it back up into
    /// the face, which is the one thing this is all here to prevent.
    static let torsoWeight = 0.25
    /// Landing on an overlay that is already on screen at that moment.
    static let neighbourWeight = 0.5

    /// How far past the detected box a face really reaches, as fractions of the
    /// frame. Vision returns the features, not the hair, the chin or the ears.
    static let sidePadding = 0.055
    static let topPadding = 0.075
    static let bottomPadding = 0.045

    /// A rect on the source picture, in the rendered frame's own fractions.
    ///
    /// The main track is fitted into the frame rather than filling it (see
    /// `CompositionBuilder.fittedTransform`), so as soon as the project's
    /// aspect differs from the footage's, a face halfway down the source is not
    /// halfway down the frame. This is the same fit, in fractions.
    static func inFrame(
        _ rect: CGRect,
        sourceAspect: Double,
        frameAspect: Double
    ) -> CGRect {
        guard sourceAspect > 0, frameAspect > 0 else { return rect }
        // Work in a frame that is `frameAspect` wide and 1 tall, so the source,
        // which is `sourceAspect` wide and 1 tall, can be fitted into it
        // directly. Both are divided back out into fractions at the end.
        let scale = min(frameAspect / sourceAspect, 1)
        let drawnWidth = sourceAspect * scale
        let originX = (frameAspect - drawnWidth) / 2
        let originY = (1 - scale) / 2
        return CGRect(
            x: (originX + rect.minX * drawnWidth) / frameAspect,
            y: originY + rect.minY * scale,
            width: rect.width * drawnWidth / frameAspect,
            height: rect.height * scale
        )
    }

    /// One box around every face seen across a span.
    ///
    /// An overlay's box is fixed for its whole life, so what it has to clear is
    /// everywhere the speaker was while it was on screen, not where they
    /// happened to be on one frame of it.
    static func union(_ rects: [CGRect]) -> CGRect? {
        guard var box = rects.first else { return nil }
        for rect in rects.dropFirst() { box = box.union(rect) }
        return box
    }

    /// What an overlay should stay off, given every face seen across its span.
    ///
    /// Two regions: the padded face itself, and the column of body below it.
    /// Splitting them is what lets a card sit on a shoulder when the frame
    /// leaves it nowhere else to go, while never sitting on a face.
    static func avoid(faces: [CGRect]) -> [SpeakerRegion] {
        guard let face = union(faces.filter { $0.width > 0 && $0.height > 0 }) else {
            return []
        }
        let padded = clamped(
            CGRect(
                x: face.minX - sidePadding,
                y: face.minY - topPadding,
                width: face.width + sidePadding * 2,
                height: face.height + topPadding + bottomPadding
            )
        )
        var regions = [SpeakerRegion(rect: padded, weight: faceWeight)]
        // Shoulders, not the whole body: one face's height below the chin. The
        // bottom of the frame is left alone, because it is usually the best
        // place a card can go.
        let shoulders = clamped(
            CGRect(
                x: padded.minX,
                y: padded.maxY,
                width: padded.width,
                height: face.height
            )
        )
        if shoulders.height > 0 {
            regions.append(SpeakerRegion(rect: shoulders, weight: torsoWeight))
        }
        return regions
    }

    /// A rect trimmed to the frame, which is where every region has to end up:
    /// padding a face near an edge would otherwise put weight outside the
    /// picture and skew every overlap against boxes near that edge.
    static func clamped(_ rect: CGRect) -> CGRect {
        let minX = min(max(0, rect.minX), 1)
        let minY = min(max(0, rect.minY), 1)
        return CGRect(
            x: minX,
            y: minY,
            width: max(0, min(1, rect.maxX) - minX),
            height: max(0, min(1, rect.maxY) - minY)
        )
    }
}
