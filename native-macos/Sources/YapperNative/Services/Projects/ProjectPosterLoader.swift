import AVFoundation
import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

/// The frame on a project's card. Cached as `poster.jpg` inside the package
/// once drawn, so the grid only ever decodes video for a project it has not
/// seen before. A project whose media is unplugged simply has no poster yet.
actor ProjectPosterLoader {
    static let shared = ProjectPosterLoader()
    private static let height: CGFloat = 480

    private var inFlight: [URL: Task<CGImage?, Never>] = [:]

    func poster(for listing: ProjectListing) async -> CGImage? {
        if let cached = Self.readJPEG(at: listing.package.posterFileURL) { return cached }
        if let task = inFlight[listing.id] { return await task.value }
        let task = Task<CGImage?, Never> {
            guard let source = listing.summary.posterSource,
                  FileManager.default.fileExists(atPath: source.mediaURL.path)
            else { return nil }
            let image = await Self.frame(at: source.time, in: source.mediaURL)
            if let image { Self.writeJPEG(image, to: listing.package.posterFileURL) }
            return image
        }
        inFlight[listing.id] = task
        let image = await task.value
        inFlight[listing.id] = nil
        return image
    }

    /// Redrawn on the next request, for a project whose first clip moved.
    func invalidate(_ package: ProjectPackage) {
        try? FileManager.default.removeItem(at: package.posterFileURL)
    }

    private static func frame(at time: Double, in url: URL) async -> CGImage? {
        let generator = AVAssetImageGenerator(asset: AVURLAsset(url: url))
        generator.appliesPreferredTrackTransform = true
        generator.maximumSize = CGSize(width: height * 2, height: height)
        generator.requestedTimeToleranceBefore = .zero
        generator.requestedTimeToleranceAfter = CMTime(seconds: 0.5, preferredTimescale: 600)
        do {
            let (image, _) = try await generator.image(at: CMTime(seconds: time, preferredTimescale: 600))
            return image
        } catch {
            return nil
        }
    }

    private static func readJPEG(at url: URL) -> CGImage? {
        guard let source = CGImageSourceCreateWithURL(url as CFURL, nil) else { return nil }
        return CGImageSourceCreateImageAtIndex(source, 0, nil)
    }

    private static func writeJPEG(_ image: CGImage, to url: URL) {
        guard let destination = CGImageDestinationCreateWithURL(
            url as CFURL, UTType.jpeg.identifier as CFString, 1, nil
        ) else { return }
        CGImageDestinationAddImage(destination, image, [kCGImageDestinationLossyCompressionQuality: 0.82] as CFDictionary)
        CGImageDestinationFinalize(destination)
    }
}
