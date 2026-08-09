@preconcurrency import AVFoundation
import CoreImage
import Foundation

/// One stretch of time where the picture is unchanged, described for the
/// compositor: which tracks are on screen, where each one goes, and the grade
/// to finish with.
///
/// AVFoundation's own instruction type only carries transforms it knows how to
/// apply. A graded composition needs a pass of its own after those, so it
/// carries its own instructions instead.
final class StudioCompositionInstruction: NSObject, AVVideoCompositionInstructionProtocol, @unchecked Sendable {
    struct Layer: Sendable {
        let trackID: CMPersistentTrackID
        /// Where the source goes in the finished frame, measured from the top
        /// left the way AVFoundation measures. At the start of the
        /// instruction's time range, when the layer moves.
        let transform: CGAffineTransform
        /// Where it has got to by the end, when the framing is keyed and the
        /// picture is moving across this stretch. `nil` when it holds still.
        ///
        /// AVFoundation's own layer instructions ramp between two transforms
        /// for exactly this, and a graded project cannot use them: the colour
        /// pass means the frames come through here instead, so the ramp has to
        /// be done by hand. Both routes have to agree, or turning on a filter
        /// would quietly flatten every punch-in in the edit.
        let endTransform: CGAffineTransform?
        /// The part of the source that is kept, in its own pixels.
        let cropRect: CGRect?
        let opacity: Float

        init(
            trackID: CMPersistentTrackID,
            transform: CGAffineTransform,
            endTransform: CGAffineTransform? = nil,
            cropRect: CGRect? = nil,
            opacity: Float = 1
        ) {
            self.trackID = trackID
            self.transform = transform
            self.endTransform = endTransform
            self.cropRect = cropRect
            self.opacity = opacity
        }

        /// The transform this layer has at `progress` through the instruction,
        /// which is a straight line between the two, exactly as
        /// `setTransformRamp` interpolates.
        func transform(at progress: Double) -> CGAffineTransform {
            guard let endTransform else { return transform }
            let t = CGFloat(min(1, max(0, progress)))
            return CGAffineTransform(
                a: transform.a + (endTransform.a - transform.a) * t,
                b: transform.b + (endTransform.b - transform.b) * t,
                c: transform.c + (endTransform.c - transform.c) * t,
                d: transform.d + (endTransform.d - transform.d) * t,
                tx: transform.tx + (endTransform.tx - transform.tx) * t,
                ty: transform.ty + (endTransform.ty - transform.ty) * t
            )
        }
    }

    let timeRange: CMTimeRange
    let enablePostProcessing = false
    /// True when anything in here moves across the instruction, so AVFoundation
    /// knows the output is not the same frame throughout and asks for each one.
    let containsTweening: Bool
    let requiredSourceTrackIDs: [NSValue]?
    let passthroughTrackID = kCMPersistentTrackID_Invalid
    /// Front to back, the way the layer instructions are ordered.
    let layers: [Layer]
    let colorMatrix: ColorMatrix

    init(timeRange: CMTimeRange, layers: [Layer], colorMatrix: ColorMatrix) {
        self.timeRange = timeRange
        self.layers = layers
        self.colorMatrix = colorMatrix
        containsTweening = layers.contains { $0.endTransform != nil }
        requiredSourceTrackIDs = layers.map { NSNumber(value: $0.trackID) }
    }
}

/// Composites the editor's own instructions and grades the result.
///
/// Only used when a project has a filter on it. Without one the composition
/// stays on AVFoundation's built-in compositor, so nothing about an ungraded
/// project changes.
final class StudioVideoCompositor: NSObject, AVVideoCompositing {
    private let context = CIContext(options: [.cacheIntermediates: false])
    private let queue = DispatchQueue(label: "yapper.compositor", qos: .userInitiated)

    let sourcePixelBufferAttributes: [String: any Sendable]? = [
        kCVPixelBufferPixelFormatTypeKey as String: [kCVPixelFormatType_32BGRA],
    ]

    let requiredPixelBufferAttributesForRenderContext: [String: any Sendable] = [
        kCVPixelBufferPixelFormatTypeKey as String: [kCVPixelFormatType_32BGRA],
    ]

    func renderContextChanged(_ newRenderContext: AVVideoCompositionRenderContext) {}

    func startRequest(_ request: AVAsynchronousVideoCompositionRequest) {
        queue.async { [weak self] in
            guard let self else { return }
            guard
                let instruction = request.videoCompositionInstruction as? StudioCompositionInstruction,
                let destination = request.renderContext.newPixelBuffer()
            else {
                request.finish(
                    with: NativeEditorError.exportFailed("The filtered compositor had nothing to draw into.")
                )
                return
            }

            let size = request.renderContext.size
            let frame = CGRect(origin: .zero, size: size)
            var output = CIImage(color: .black).cropped(to: frame)

            // How far into this instruction the frame being asked for is, which
            // is what a moving layer is drawn from.
            let span = instruction.timeRange.duration.seconds
            let progress = span > 0
                ? (request.compositionTime - instruction.timeRange.start).seconds / span
                : 0

            // Back to front, so the speaker goes down before the cutaways.
            for layer in instruction.layers.reversed() {
                guard
                    layer.opacity > 0,
                    let source = request.sourceFrame(byTrackID: layer.trackID)
                else { continue }
                var image = CIImage(cvPixelBuffer: source)
                let sourceHeight = image.extent.height

                if let cropRect = layer.cropRect {
                    image = image.cropped(
                        to: CGRect(
                            x: cropRect.minX,
                            y: sourceHeight - cropRect.maxY,
                            width: cropRect.width,
                            height: cropRect.height
                        )
                    )
                }

                // Core Image measures from the bottom left and AVFoundation
                // from the top left, so the transform is flipped into place on
                // the way in and back out again.
                let intoTopLeft = CGAffineTransform(1, 0, 0, -1, 0, sourceHeight)
                let backToBottomLeft = CGAffineTransform(1, 0, 0, -1, 0, size.height)
                image = image.transformed(
                    by: intoTopLeft
                        .concatenating(layer.transform(at: progress))
                        .concatenating(backToBottomLeft)
                )

                if layer.opacity < 1 {
                    image = image.applyingFilter(
                        "CIColorMatrix",
                        parameters: [
                            "inputAVector": CIVector(x: 0, y: 0, z: 0, w: CGFloat(layer.opacity)),
                        ]
                    )
                }
                output = image.composited(over: output)
            }

            if
                !instruction.colorMatrix.isIdentity,
                let filter = instruction.colorMatrix.coreImageFilter
            {
                filter.setValue(output, forKey: kCIInputImageKey)
                if let graded = filter.outputImage { output = graded }
            }

            self.context.render(output.cropped(to: frame), to: destination)
            request.finish(withComposedVideoFrame: destination)
        }
    }

    func cancelAllPendingVideoCompositionRequests() {}
}
