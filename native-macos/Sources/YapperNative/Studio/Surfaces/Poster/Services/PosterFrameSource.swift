@preconcurrency import AVFoundation
import CoreGraphics

/// Exact frames from a remote master, for the cover picker and the
/// filmstrip. Frame times sit on the video's own frame grid, so stepping
/// one frame lands on the next real frame rather than a blend.
final class PosterFrameSource: @unchecked Sendable {
    let duration: Double
    let fps: Double
    private let generator: AVAssetImageGenerator
    private let tiles: AVAssetImageGenerator

    private init(asset: AVURLAsset, duration: Double, fps: Double) {
        self.duration = duration
        self.fps = fps
        generator = AVAssetImageGenerator(asset: asset)
        generator.appliesPreferredTrackTransform = true
        generator.requestedTimeToleranceBefore = .zero
        generator.requestedTimeToleranceAfter = .zero
        generator.maximumSize = CGSize(width: 1080, height: 1920)
        tiles = AVAssetImageGenerator(asset: asset)
        tiles.appliesPreferredTrackTransform = true
        tiles.maximumSize = CGSize(width: 120, height: 213)
        tiles.requestedTimeToleranceBefore = CMTime(seconds: 0.5, preferredTimescale: 600)
        tiles.requestedTimeToleranceAfter = CMTime(seconds: 0.5, preferredTimescale: 600)
    }

    static func open(_ url: URL) async throws -> PosterFrameSource {
        let asset = AVURLAsset(url: url)
        let duration = try await asset.load(.duration).seconds
        let track = try await asset.loadTracks(withMediaType: .video).first
        let rate = try await track?.load(.nominalFrameRate) ?? 30
        guard duration.isFinite, duration > 0 else { throw PosterUploadFailure("video_unavailable") }
        return PosterFrameSource(asset: asset, duration: duration, fps: rate > 0 ? Double(rate) : 30)
    }

    var frameCount: Int { max(1, Int((duration * fps).rounded(.down))) }

    func time(ofFrame index: Int) -> Double {
        min(duration, Double(max(0, min(index, frameCount - 1))) / fps)
    }

    func frameIndex(at time: Double) -> Int {
        max(0, min(frameCount - 1, Int((time * fps).rounded())))
    }

    func frame(at index: Int) async throws -> CGImage {
        let time = CMTime(seconds: time(ofFrame: index), preferredTimescale: 60_000)
        return try await generator.image(at: time).image
    }

    /// Evenly spaced small frames for the strip under the scrubber.
    func filmstrip(count: Int) async -> [CGImage?] {
        var result: [CGImage?] = []
        for step in 0..<count {
            let seconds = duration * (Double(step) + 0.5) / Double(count)
            let image = try? await tiles.image(at: CMTime(seconds: seconds, preferredTimescale: 600)).image
            result.append(image)
        }
        return result
    }

    /// One still for a library card: a moment in, not the black first frame.
    static func poster(for url: URL) async throws -> CGImage {
        let asset = AVURLAsset(url: url)
        let duration = try await asset.load(.duration).seconds
        let generator = AVAssetImageGenerator(asset: asset)
        generator.appliesPreferredTrackTransform = true
        generator.maximumSize = CGSize(width: 360, height: 640)
        let seconds = duration.isFinite && duration > 0 ? min(1, duration / 2) : 0
        return try await generator.image(at: CMTime(seconds: seconds, preferredTimescale: 600)).image
    }
}
