@preconcurrency import AVFoundation
import AppKit
import CryptoKit
import Foundation
import UniformTypeIdentifiers

enum MediaProbe {
    static func inspect(url: URL) async throws -> ProjectMedia {
        if let type = try? url.resourceValues(forKeys: [.contentTypeKey]).contentType,
           type.conforms(to: .image),
           let image = NSImage(contentsOf: url)
        {
            let fingerprint = try await MediaSourceFingerprint.compute(url: url)
            return ProjectMedia(
                url: url,
                name: url.lastPathComponent,
                duration: 4,
                width: max(1, Int(image.size.width.rounded())),
                height: max(1, Int(image.size.height.rounded())),
                hasAudio: false,
                kind: .image,
                sourceFingerprint: fingerprint
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
        let fingerprint = try await MediaSourceFingerprint.compute(url: url)

        return ProjectMedia(
            url: url,
            name: url.lastPathComponent,
            duration: videoTimeRange.duration.seconds,
            width: Int(abs(transformed.width).rounded()),
            height: Int(abs(transformed.height).rounded()),
            hasAudio: !audioTracks.isEmpty,
            kind: .video,
            sourceFingerprint: fingerprint
        )
    }

}

enum MediaSourceFingerprint {
    private static let chunkSize: UInt64 = 64 * 1024

    /// A versioned, bounded identity probe. File size plus first/middle/last
    /// chunks detects replacement without reading multi-gigabyte footage twice.
    static func compute(
        url: URL,
        beforeRead: (@Sendable () async throws -> Void)? = nil
    ) async throws -> String {
        let work = Task.detached(priority: .utility) {
            let size = try url.resourceValues(forKeys: [.fileSizeKey]).fileSize.map(UInt64.init) ?? 0
            let handle = try FileHandle(forReadingFrom: url)
            defer { try? handle.close() }
            var hash = SHA256()
            hash.update(data: Data("sampled-v1:\(size):".utf8))
            let offsets = Set([UInt64(0), size > chunkSize ? (size - chunkSize) / 2 : 0, size > chunkSize ? size - chunkSize : 0]).sorted()
            for offset in offsets {
                try Task.checkCancellation()
                try await beforeRead?()
                try handle.seek(toOffset: offset)
                let data = try handle.read(upToCount: Int(min(chunkSize, size - min(size, offset)))) ?? Data()
                hash.update(data: Data("\(offset):\(data.count):".utf8))
                hash.update(data: data)
            }
            try Task.checkCancellation()
            return "sha256-sampled-v1:" + hash.finalize().map { String(format: "%02x", $0) }.joined()
        }
        return try await withTaskCancellationHandler {
            try await work.value
        } onCancel: {
            work.cancel()
        }
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
    case missingSoundEffect(String)
    case incompatibleMedia(String)

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
        case let .missingSoundEffect(name):
            "The \(name) sound effect is missing from this build."
        case let .incompatibleMedia(name):
            "\(name) does not appear to be the same source media. Use it as a separate import instead."
        case let .cannotCreateTrack(kind):
            "AVFoundation could not create the \(kind) composition track."
        case let .exportFailed(message):
            "Export failed: \(message)"
        case let .aiFailed(message):
            "AI edit failed: \(message)"
        }
    }
}
