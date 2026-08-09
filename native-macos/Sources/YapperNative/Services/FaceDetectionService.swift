@preconcurrency import AVFoundation
import CoreGraphics
import Foundation
import Vision

/// Finding the speaker on screen, so a cutaway can be put somewhere else.
///
/// Everything here happens on this machine. Nothing is uploaded, nothing is
/// paid for, and a probe that fails costs a placement its face data rather than
/// failing the placement: every path returns what it found, which may be
/// nothing, and never throws.
///
/// Rects come back as fractions of the oriented source picture with the origin
/// at the top left. Vision measures from the bottom left; that is flipped once,
/// here, so nothing downstream has to remember which way up it is.
actor FaceDetectionService {
    /// Faces are looked for at this size. A face that cannot be found in 480
    /// pixels is too small to be worth placing an overlay around, and decoding
    /// the full frame costs many times more.
    private static let sampleWidth = 480.0

    /// How far off the asked-for moment a frame may be. Exact extraction has to
    /// decode from the last keyframe, which on long footage is slow; a face
    /// does not travel far in a third of a second.
    private static let timeTolerance = 0.3

    /// Times are rounded to this before they are looked up, so the coarse pass
    /// that feeds the prompt and the dense pass that repairs the box share work
    /// instead of decoding the same frames twice.
    private static let cacheStep = 0.25

    private struct Key: Hashable {
        let media: UUID
        let tick: Int
    }

    private var cache: [Key: [CGRect]] = [:]

    /// Where the speaker is at each of these moments in one video, keyed by the
    /// moment that was asked for. Moments with nothing found are left out.
    func faces(in media: ProjectMedia, at sourceTimes: [Double]) async -> [Double: [CGRect]] {
        guard !media.isImage, !sourceTimes.isEmpty else { return [:] }
        var found: [Double: [CGRect]] = [:]
        var generator: AVAssetImageGenerator?

        for time in sourceTimes {
            let key = Key(media: media.id, tick: Int((time / Self.cacheStep).rounded()))
            if let cached = cache[key] {
                if !cached.isEmpty { found[time] = cached }
                continue
            }
            if generator == nil { generator = Self.makeGenerator(for: media) }
            guard let generator else { break }
            let rects = await Self.faces(from: generator, at: time)
            cache[key] = rects
            if !rects.isEmpty { found[time] = rects }
        }
        return found
    }

    /// Everywhere the speaker was across these moments, as one box.
    ///
    /// An overlay's box is fixed for its whole life, so what it has to clear is
    /// the union, not where the speaker happened to be on one frame of it.
    func faceUnion(in media: ProjectMedia, at sourceTimes: [Double]) async -> CGRect? {
        let byTime = await faces(in: media, at: sourceTimes)
        return SpeakerRegions.union(byTime.values.flatMap { $0 })
    }

    private static func makeGenerator(for media: ProjectMedia) -> AVAssetImageGenerator {
        let generator = AVAssetImageGenerator(asset: AVURLAsset(url: media.url))
        generator.appliesPreferredTrackTransform = true
        generator.maximumSize = CGSize(width: sampleWidth, height: sampleWidth)
        let tolerance = CMTime(
            seconds: timeTolerance,
            preferredTimescale: CompositionBuilder.timeScale
        )
        generator.requestedTimeToleranceBefore = tolerance
        generator.requestedTimeToleranceAfter = tolerance
        return generator
    }

    private static func faces(
        from generator: AVAssetImageGenerator,
        at seconds: Double
    ) async -> [CGRect] {
        let time = CMTime(
            seconds: max(0, seconds),
            preferredTimescale: CompositionBuilder.timeScale
        )
        guard let frame = try? await generator.image(at: time).image else { return [] }
        return detect(in: frame)
    }

    /// The faces on one frame, or, when there are none, whatever the frame is
    /// actually about.
    ///
    /// The fallback matters more than it looks: a product held up to the lens,
    /// a screen recording, a shot where the speaker has stepped aside. Covering
    /// the subject of the shot is the same mistake as covering a face, and
    /// saliency is the only thing that knows what the subject is.
    private static func detect(in frame: CGImage) -> [CGRect] {
        let handler = VNImageRequestHandler(cgImage: frame, options: [:])

        let faces = VNDetectFaceRectanglesRequest()
        if (try? handler.perform([faces])) != nil {
            let boxes = (faces.results ?? []).map { flipped($0.boundingBox) }
            if !boxes.isEmpty { return boxes }
        }

        let saliency = VNGenerateAttentionBasedSaliencyImageRequest()
        guard
            (try? handler.perform([saliency])) != nil,
            let observation = saliency.results?.first,
            let objects = observation.salientObjects,
            !objects.isEmpty
        else { return [] }
        // Only the strongest region. Attention saliency happily returns half
        // the frame in pieces, and treating all of it as untouchable would
        // leave a cutaway nowhere to go.
        let strongest = objects.max { $0.confidence < $1.confidence }
        return strongest.map { [flipped($0.boundingBox)] } ?? []
    }

    /// Vision's normalised box, measured from the top left instead.
    private static func flipped(_ box: CGRect) -> CGRect {
        CGRect(
            x: box.minX,
            y: 1 - box.maxY,
            width: box.width,
            height: box.height
        )
    }
}
