@preconcurrency import AVFoundation
import CoreGraphics
import Foundation

actor ThumbnailService {
    private var cache: [UUID: CGImage] = [:]

    func thumbnail(for media: ProjectMedia) async throws -> CGImage {
        if let cached = cache[media.id] { return cached }
        let asset = AVURLAsset(url: media.url)
        let generator = AVAssetImageGenerator(asset: asset)
        generator.appliesPreferredTrackTransform = true
        generator.maximumSize = CGSize(width: 480, height: 270)
        generator.requestedTimeToleranceBefore = .positiveInfinity
        generator.requestedTimeToleranceAfter = .positiveInfinity
        let time = CMTime(
            seconds: min(max(0, media.duration * 0.25), 2),
            preferredTimescale: CompositionBuilder.timeScale
        )
        let image = try await generator.image(at: time).image
        cache[media.id] = image
        return image
    }
}
