@preconcurrency import AVFoundation
import CoreImage
import CoreVideo
import Foundation
import Vision

/// Cutting the speaker out of a frame, so something can be drawn behind them.
///
/// Everything here happens on this machine. Vision's person segmentation is
/// local and free, which is what makes this affordable to run on every frame of
/// an export rather than a paid effect a creator has to ration.
///
/// A frame nobody is found in comes back without a mask rather than as an
/// error, and the compositor then draws nothing for that layer. That is the
/// honest answer in both places this is used: a cutaway meant to sit behind the
/// speaker has no speaker to hide behind, and a clip with its background
/// removed has nothing left to show. A thrown error would fail the export over
/// one frame the model was unsure about.
///
/// Held by the compositor and only ever touched from its serial queue, which
/// is what the unchecked conformance is standing on: the cache has no lock
/// because it has no second caller.
final class PersonMatteService: @unchecked Sendable {
    private struct Key: Hashable {
        let trackID: CMPersistentTrackID
        let value: CMTimeValue
        let timescale: CMTimeScale
        let isAccurate: Bool
    }

    /// A paused preview re-renders the same frame every time anything on the
    /// canvas moves, and one clip drawn both whole and cut out asks for the
    /// same mask twice in a single frame. A handful of entries covers both
    /// without holding onto frames nobody is looking at any more.
    private static let cacheLimit = 4

    /// Reused between frames. Building one per frame is not free, and the
    /// request carries no state from the frame before it.
    private let request = VNGeneratePersonSegmentationRequest()

    private var cache: [Key: CIImage] = [:]
    private var order: [Key] = []

    /// The person-shaped mask for one frame, scaled to that frame's own pixels
    /// and white where the person is. `nil` when there is nobody to cut out.
    func mask(
        for buffer: CVPixelBuffer,
        trackID: CMPersistentTrackID,
        at time: CMTime,
        quality: MatteQuality
    ) -> CIImage? {
        let key = Key(
            trackID: trackID,
            value: time.value,
            timescale: time.timescale,
            isAccurate: quality == .accurate
        )
        if let cached = cache[key] { return cached }

        request.qualityLevel = quality == .accurate ? .accurate : .fast
        request.outputPixelFormat = kCVPixelFormatType_OneComponent8
        guard
            (try? VNImageRequestHandler(cvPixelBuffer: buffer, options: [:])
                .perform([request])) != nil,
            let segmented = (request.results?.first as? VNPixelBufferObservation)?.pixelBuffer
        else { return nil }

        let height = CGFloat(CVPixelBufferGetHeight(buffer))
        let raw = CIImage(cvPixelBuffer: segmented)
        guard !raw.extent.isEmpty else { return nil }

        // The mask comes back at whatever size the model works at, which is
        // never the frame's, so it is stretched onto the frame before anything
        // measured in frame pixels touches it.
        let scaled = raw.transformed(
            by: CGAffineTransform(
                scaleX: CGFloat(CVPixelBufferGetWidth(buffer)) / raw.extent.width,
                y: height / raw.extent.height
            )
        )
        let finished = MatteEdge.finish(scaled, frameHeight: height)
        store(finished, for: key)
        return finished
    }

    private func store(_ mask: CIImage, for key: Key) {
        cache[key] = mask
        order.append(key)
        while order.count > Self.cacheLimit {
            cache.removeValue(forKey: order.removeFirst())
        }
    }
}
