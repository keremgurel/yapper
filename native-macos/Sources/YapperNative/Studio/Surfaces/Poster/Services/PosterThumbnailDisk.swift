import CoreGraphics
import CryptoKit
import Foundation
import ImageIO
import UniformTypeIdentifiers

/// Library stills kept on disk between launches. A take's file never changes
/// under its submission or storage key, so a still pulled from it once is
/// good for as long as the take exists; without this every launch streamed
/// part of each video again just to draw its card.
enum PosterThumbnailDisk {
    private static let directory: URL? = {
        guard let base = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first else { return nil }
        let folder = base.appending(path: "YapperNative/poster-stills", directoryHint: .isDirectory)
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        return folder
    }()

    static func read(_ media: PosterMediaRef) -> CGImage? {
        guard let file = file(for: media),
              let source = CGImageSourceCreateWithURL(file as CFURL, nil)
        else { return nil }
        return CGImageSourceCreateImageAtIndex(source, 0, nil)
    }

    static func write(_ image: CGImage, for media: PosterMediaRef) {
        guard let file = file(for: media),
              let destination = CGImageDestinationCreateWithURL(file as CFURL, UTType.jpeg.identifier as CFString, 1, nil)
        else { return }
        CGImageDestinationAddImage(destination, image, [kCGImageDestinationLossyCompressionQuality: 0.8] as CFDictionary)
        CGImageDestinationFinalize(destination)
    }

    private static func file(for media: PosterMediaRef) -> URL? {
        guard let directory, let identity = media.mediaKey ?? media.submissionID, !identity.isEmpty else { return nil }
        let digest = SHA256.hash(data: Data(identity.utf8)).map { String(format: "%02x", $0) }.joined()
        return directory.appending(path: "\(digest).jpg")
    }
}
