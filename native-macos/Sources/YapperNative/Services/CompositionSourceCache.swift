@preconcurrency import AVFoundation
import CoreGraphics
import Foundation

/// A source file with everything a composition needs to know about it.
struct LoadedSource {
    // AVAssetTrack does not retain all of the source asset's loading state.
    // Keep the asset alive for as long as the track is used.
    let asset: AVURLAsset
    let video: AVAssetTrack
    let audio: AVAssetTrack?
    let videoSize: CGSize
    let videoTransform: CGAffineTransform
    let audioTimeRange: CMTimeRange?
    let frameRate: Float
    let duration: Double
}

/// A sound file placed on the audio track.
struct LoadedAudioSource {
    let asset: AVURLAsset
    let track: AVAssetTrack
    let timeRange: CMTimeRange
}

/// Keeps every source file's loaded tracks between composition builds.
///
/// Opening an `AVURLAsset` and loading its tracks is by far the slowest part of
/// building a composition, and the editor rebuilds after every trim, split,
/// drop and reorder. The files do not change while the project is open, so a
/// rebuild reuses what the previous one read instead of going back to disk.
///
/// Entries are keyed by URL and checked against the file's modification date,
/// so a file that really is replaced on disk still gets re-read.
final class CompositionSourceCache: @unchecked Sendable {
    static let shared = CompositionSourceCache()

    private struct Entry<Value> {
        let modified: Date?
        let value: Value
    }

    private let lock = NSLock()
    private var videoSources: [URL: Entry<LoadedSource>] = [:]
    private var audioSources: [URL: Entry<LoadedAudioSource>] = [:]

    func source(for media: ProjectMedia) async throws -> LoadedSource {
        let url = media.url
        let modified = Self.modificationDate(of: url)
        if let cached = read(from: \.videoSources, url: url, modified: modified) {
            return cached
        }

        let asset = AVURLAsset(url: url)
        let videoTracks = try await asset.loadTracks(withMediaType: .video)
        guard let video = videoTracks.first else {
            throw NativeEditorError.noVideoTrack(media.name)
        }
        let audio = try await asset.loadTracks(withMediaType: .audio).first
        let timeRange = try await video.load(.timeRange)
        let source = LoadedSource(
            asset: asset,
            video: video,
            audio: audio,
            videoSize: try await video.load(.naturalSize),
            videoTransform: try await video.load(.preferredTransform),
            audioTimeRange: try await audio?.load(.timeRange),
            frameRate: try await video.load(.nominalFrameRate),
            duration: timeRange.duration.seconds
        )
        lock.withLock { videoSources[url] = Entry(modified: modified, value: source) }
        return source
    }

    func audioSource(for url: URL, name: String) async throws -> LoadedAudioSource {
        let modified = Self.modificationDate(of: url)
        if let cached = read(from: \.audioSources, url: url, modified: modified) {
            return cached
        }

        let asset = AVURLAsset(url: url)
        guard let track = try await asset.loadTracks(withMediaType: .audio).first else {
            throw NativeEditorError.noAudioTrack(name)
        }
        let source = LoadedAudioSource(
            asset: asset,
            track: track,
            timeRange: try await track.load(.timeRange)
        )
        lock.withLock { audioSources[url] = Entry(modified: modified, value: source) }
        return source
    }

    /// Drops a file the project no longer holds, so a long session does not
    /// keep every video it has ever opened alive.
    func forget(_ url: URL) {
        lock.withLock {
            videoSources[url] = nil
            audioSources[url] = nil
        }
    }

    /// Keeps only the files the project still uses.
    func keepOnly(_ urls: Set<URL>) {
        lock.withLock {
            videoSources = videoSources.filter { urls.contains($0.key) }
            audioSources = audioSources.filter { urls.contains($0.key) }
        }
    }

    var cachedEntryCount: Int {
        lock.withLock { videoSources.count + audioSources.count }
    }

    private func read<Value>(
        from keyPath: KeyPath<CompositionSourceCache, [URL: Entry<Value>]>,
        url: URL,
        modified: Date?
    ) -> Value? {
        lock.withLock {
            guard let entry = self[keyPath: keyPath][url] else { return nil }
            guard entry.modified == modified else { return nil }
            return entry.value
        }
    }

    private static func modificationDate(of url: URL) -> Date? {
        try? url.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate
    }
}
