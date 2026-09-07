@preconcurrency import AVFoundation
import CoreGraphics
import CoreImage
import CoreVideo
import Foundation
import Vision

/// Where the face is on one frame, in that frame's own pixels.
///
/// Measured the way Core Image measures, with the origin at the bottom left,
/// because the only thing that reads this is the compositor and that is the
/// space it draws in. `FaceDetectionService` flips its results the other way
/// for the same reason: it feeds overlay placement, which is measured from the
/// top left.
struct FaceRegion: Sendable {
    /// The box Vision drew around the face.
    let bounds: CGRect
    /// The outline of the mouth opening, empty when the mouth was not found.
    /// Closed lips give a flat sliver rather than nothing.
    let innerLips: [CGPoint]
}

/// Finding the face on a frame that is already in memory.
///
/// Separate from `FaceDetectionService`, which answers the same question from a
/// media file and a timestamp so a cutaway can be placed away from the speaker.
/// This one is asked by the compositor, per frame, about a buffer it is holding,
/// and has to be cheap enough to run at playback speed.
///
/// Only ever touched from the compositor's own serial queue.
final class FaceRegionService: @unchecked Sendable {
    private struct Key: Hashable {
        let trackID: CMPersistentTrackID
        let value: CMTimeValue
        let timescale: CMTimeScale
    }

    /// The same handful as the matte cache, and for the same reason: a paused
    /// preview asks for one frame over and over.
    private static let cacheLimit = 4

    private let request: VNDetectFaceLandmarksRequest = {
        let request = VNDetectFaceLandmarksRequest()
        // The mouth is the only landmark either effect reads, and the
        // constellation is a good deal cheaper than the full 76-point set.
        request.constellation = .constellation65Points
        return request
    }()

    private var cache: [Key: FaceRegion?] = [:]
    private var order: [Key] = []

    /// The largest face on this frame, or `nil` when there is none.
    ///
    /// Largest rather than all of them: retouching is something a creator turns
    /// on for their own face in a talking head, and smoothing everyone in shot
    /// because they wandered past is not what was asked for.
    func face(
        in buffer: CVPixelBuffer,
        trackID: CMPersistentTrackID,
        at time: CMTime
    ) -> FaceRegion? {
        let key = Key(trackID: trackID, value: time.value, timescale: time.timescale)
        if let cached = cache[key] { return cached }

        let width = CGFloat(CVPixelBufferGetWidth(buffer))
        let height = CGFloat(CVPixelBufferGetHeight(buffer))
        guard
            (try? VNImageRequestHandler(cvPixelBuffer: buffer, options: [:])
                .perform([request])) != nil,
            let observation = request.results?.max(by: {
                $0.boundingBox.width * $0.boundingBox.height
                    < $1.boundingBox.width * $1.boundingBox.height
            })
        else {
            store(nil, for: key)
            return nil
        }

        let box = observation.boundingBox
        let bounds = CGRect(
            x: box.minX * width,
            y: box.minY * height,
            width: box.width * width,
            height: box.height * height
        )
        // Landmarks come back as fractions of the face box, not of the frame,
        // so they are walked out to the box before being scaled to pixels.
        let lips = (observation.landmarks?.innerLips?.normalizedPoints ?? []).map { point in
            CGPoint(
                x: bounds.minX + point.x * bounds.width,
                y: bounds.minY + point.y * bounds.height
            )
        }
        let region = FaceRegion(bounds: bounds, innerLips: lips)
        store(region, for: key)
        return region
    }

    private func store(_ region: FaceRegion?, for key: Key) {
        cache[key] = region
        order.append(key)
        while order.count > Self.cacheLimit {
            cache.removeValue(forKey: order.removeFirst())
        }
    }
}
