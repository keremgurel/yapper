@preconcurrency import AVFoundation
import CoreGraphics
import Foundation

actor ThumbnailService {
    typealias Progress = @MainActor @Sendable (_ images: [CGImage]) -> Void
    private var cache: [UUID: [CGImage]] = [:]

    func thumbnails(
        for media: ProjectMedia,
        count: Int = 16,
        onProgress: Progress
    ) async throws -> [CGImage] {
        if let cached = cache[media.id] { return cached }
        let asset = AVURLAsset(url: media.url)
        let generator = AVAssetImageGenerator(asset: asset)
        generator.appliesPreferredTrackTransform = true
        generator.maximumSize = CGSize(width: 320, height: 180)
        generator.requestedTimeToleranceBefore = .positiveInfinity
        generator.requestedTimeToleranceAfter = .positiveInfinity
        let sampleCount = max(1, count)
        var images: [CGImage] = []
        images.reserveCapacity(sampleCount)
        for index in 0 ..< sampleCount {
            let fraction = (Double(index) + 0.5) / Double(sampleCount)
            let seconds = min(max(0, media.duration * fraction), max(0, media.duration - 0.01))
            let time = CMTime(
                seconds: seconds,
                preferredTimescale: CompositionBuilder.timeScale
            )
            images.append(try await generator.image(at: time).image)
            await onProgress(images)
        }
        cache[media.id] = images
        return images
    }
}
