@preconcurrency import AVFoundation
import CoreGraphics
import Foundation

actor ThumbnailService {
    typealias Progress = @MainActor @Sendable (_ images: [CGImage]) -> Void

    private struct CacheKey: Hashable {
        let mediaID: UUID
        let url: URL
        let sourceFingerprint: String?
        let size: Int64
        let modified: Date?
        let duration: Double
        let count: Int
    }

    private var cache: [CacheKey: [CGImage]] = [:]

    func thumbnails(
        for media: ProjectMedia,
        count: Int = 16,
        onProgress: Progress
    ) async throws -> [CGImage] {
        let attributes = try? FileManager.default.attributesOfItem(atPath: media.url.path)
        let key = CacheKey(
            mediaID: media.id,
            url: media.url,
            sourceFingerprint: media.sourceFingerprint,
            size: (attributes?[.size] as? NSNumber)?.int64Value ?? 0,
            modified: attributes?[.modificationDate] as? Date,
            duration: media.duration,
            count: count
        )
        if let cached = cache[key] {
            await onProgress(cached)
            return cached
        }
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
            try Task.checkCancellation()
            let fraction = (Double(index) + 0.5) / Double(sampleCount)
            let seconds = min(max(0, media.duration * fraction), max(0, media.duration - 0.01))
            let time = CMTime(
                seconds: seconds,
                preferredTimescale: CompositionBuilder.timeScale
            )
            images.append(try await generator.image(at: time).image)
            await onProgress(images)
        }
        try Task.checkCancellation()
        cache[key] = images
        return images
    }

    func invalidate(mediaID: UUID) {
        cache = cache.filter { $0.key.mediaID != mediaID }
    }
}
