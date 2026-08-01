@preconcurrency import AVFoundation
import AppKit
import Foundation
import UniformTypeIdentifiers

enum MediaProbe {
    static func inspect(url: URL) async throws -> ProjectMedia {
        if let type = try? url.resourceValues(forKeys: [.contentTypeKey]).contentType,
           type.conforms(to: .image),
           let image = NSImage(contentsOf: url)
        {
            return ProjectMedia(
                url: url,
                name: url.lastPathComponent,
                duration: 4,
                width: max(1, Int(image.size.width.rounded())),
                height: max(1, Int(image.size.height.rounded())),
                hasAudio: false,
                kind: .image
            )
        }
        let asset = AVURLAsset(url: url)
        let videoTracks = try await asset.loadTracks(withMediaType: .video)
        guard let videoTrack = videoTracks.first else {
            throw NativeEditorError.noVideoTrack(url.lastPathComponent)
        }
        let naturalSize = try await videoTrack.load(.naturalSize)
        let transform = try await videoTrack.load(.preferredTransform)
        let videoTimeRange = try await videoTrack.load(.timeRange)
        let transformed = naturalSize.applying(transform)
        let audioTracks = try await asset.loadTracks(withMediaType: .audio)

        return ProjectMedia(
            url: url,
            name: url.lastPathComponent,
            duration: videoTimeRange.duration.seconds,
            width: Int(abs(transformed.width).rounded()),
            height: Int(abs(transformed.height).rounded()),
            hasAudio: !audioTracks.isEmpty,
            kind: .video
        )
    }
}

enum NativeEditorError: LocalizedError {
    case noVideoTrack(String)
    case noAudioTrack(String)
    case missingMedia(UUID)
    case emptyTimeline
    case cannotCreateTrack(String)
    case exportFailed(String)
    case aiFailed(String)

    var errorDescription: String? {
        switch self {
        case let .noVideoTrack(name):
            "No video track was found in \(name)."
        case let .noAudioTrack(name):
            "No audio track was found in \(name)."
        case let .missingMedia(id):
            "The project cannot find media \(id)."
        case .emptyTimeline:
            "Add at least one clip before playing or exporting."
        case let .cannotCreateTrack(kind):
            "AVFoundation could not create the \(kind) composition track."
        case let .exportFailed(message):
            "Export failed: \(message)"
        case let .aiFailed(message):
            "AI edit failed: \(message)"
        }
    }
}
