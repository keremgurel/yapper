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
    struct Layer: @unchecked Sendable {
        /// Where a layer's picture comes from.
        enum Source: @unchecked Sendable {
            /// A frame of one of the composition's own tracks.
            case track(CMPersistentTrackID)
            /// A still, decoded once when the composition was built.
            ///
            /// Stills are normally burned in afterwards by Core Animation,
            /// which is cheaper and needs no track. They come through here only
            /// when the project has a cut-out in it, because Core Animation
            /// draws over the finished video and a card that has to sit *under*
            /// the speaker cannot be drawn on top of them.
            case still(CIImage)
        }

        let source: Source
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
        /// True when only the person in this layer is drawn and the rest of the
        /// frame is thrown away.
        ///
        /// This is the whole of both effects. A cutaway that sits behind the
        /// speaker is the speaker's own clip listed twice, whole underneath and
        /// matted on top with the cutaway between them. A clip with its
        /// background removed is the same clip listed once, matted, with
        /// whatever is beneath it showing through.
        let matte: Bool
        /// The rounding and shadow that make a still read as a card sitting on
        /// the picture. `nil` on tracks, and on a still cut to the whole frame,
        /// which is a graphic rather than a card.
        let card: OverlayCardStyle?

        /// The track this layer draws, when it draws one.
        var trackID: CMPersistentTrackID? {
            guard case let .track(id) = source else { return nil }
            return id
        }

        init(
            source: Source,
            transform: CGAffineTransform,
            endTransform: CGAffineTransform? = nil,
            cropRect: CGRect? = nil,
            opacity: Float = 1,
            matte: Bool = false,
            card: OverlayCardStyle? = nil
        ) {
            self.source = source
            self.transform = transform
            self.endTransform = endTransform
            self.cropRect = cropRect
            self.opacity = opacity
            self.matte = matte
            self.card = card
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
    /// How carefully the matted layers, if any, are cut out.
    let matteQuality: MatteQuality
    /// What the frame is filled with before anything is drawn on it: behind a
    /// clip with its background removed, and in any letterboxing.
    let backdrop: CIColor

    init(
        timeRange: CMTimeRange,
        layers: [Layer],
        colorMatrix: ColorMatrix,
        matteQuality: MatteQuality = .accurate,
        backdrop: CIColor = .black
    ) {
        self.timeRange = timeRange
        self.layers = layers
        self.colorMatrix = colorMatrix
        self.matteQuality = matteQuality
        self.backdrop = backdrop
        // A matted layer is a different shape on every frame even when nothing
        // in the edit moves, so an instruction carrying one is never a still.
        containsTweening = layers.contains { $0.endTransform != nil || $0.matte }
        // A track drawn both whole and cut out is named twice, and asking
        // AVFoundation for the same source twice is not a request it honours.
        // Stills are not sources at all: they are already decoded.
        var seen = Set<CMPersistentTrackID>()
        requiredSourceTrackIDs = layers
            .compactMap(\.trackID)
            .filter { seen.insert($0).inserted }
            .map { NSNumber(value: $0) }
    }
}

extension StudioColor {
    /// The same colour, as Core Image wants it. Kept here rather than on the
    /// model, which stays clear of rendering types on purpose.
    var ciColor: CIColor {
        CIColor(red: red, green: green, blue: blue, alpha: opacity)
    }
}

/// Composites the editor's own instructions: places the layers, cuts the
/// speaker out of the ones asking for it, and grades the result.
///
/// Only used for what AVFoundation's own compositor cannot express, which is a
/// grade, a cut-out, or a frame filled with anything but black. A project with
/// none of those stays on the built-in compositor and is unchanged by any of
/// this. See `EditorProject.needsStudioCompositor`.
final class StudioVideoCompositor: NSObject, AVVideoCompositing {
    private let context = CIContext(options: [.cacheIntermediates: false])
    private let queue = DispatchQueue(label: "yapper.compositor", qos: .userInitiated)
    /// Only ever touched from `queue`.
    private let mattes = PersonMatteService()

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
            var output = CIImage(color: instruction.backdrop).cropped(to: frame)

            // How far into this instruction the frame being asked for is, which
            // is what a moving layer is drawn from.
            let span = instruction.timeRange.duration.seconds
            let progress = span > 0
                ? (request.compositionTime - instruction.timeRange.start).seconds / span
                : 0

            // Back to front, so the speaker goes down before the cutaways.
            for layer in instruction.layers.reversed() {
                guard layer.opacity > 0 else { continue }

                var image: CIImage
                switch layer.source {
                case let .still(still):
                    image = still
                case let .track(trackID):
                    guard let source = request.sourceFrame(byTrackID: trackID) else { continue }
                    image = CIImage(cvPixelBuffer: source)
                    if layer.matte {
                        // Cut out before the crop and the transform, so the
                        // mask is measured in the same pixels it was worked out
                        // from. A frame with nobody in it leaves this layer
                        // undrawn.
                        guard let mask = self.mattes.mask(
                            for: source,
                            trackID: trackID,
                            at: request.compositionTime,
                            quality: instruction.matteQuality
                        ) else { continue }
                        image = image.applyingFilter(
                            "CIBlendWithMask",
                            parameters: [
                                kCIInputBackgroundImageKey: CIImage(color: .clear)
                                    .cropped(to: image.extent),
                                kCIInputMaskImageKey: mask,
                            ]
                        )
                    }
                }
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

                // Rounded and shadowed once the card is at the size it will be
                // seen at, not before: a radius worked out on the source would
                // be scaled along with the picture, and a small screenshot
                // blown up would come out with balloon corners.
                if let card = layer.card {
                    image = OverlayCard.drawn(image, style: card)
                }

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
