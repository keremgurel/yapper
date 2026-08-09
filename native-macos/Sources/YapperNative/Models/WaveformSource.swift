import Foundation

/// A sound a waveform can be drawn for: a recording in the bin, or a sound
/// effect laid on the audio track.
///
/// The key names the cache entry. Two layers holding the same sound effect are
/// the same file, so they share one decode and one drawing. Dropping the same
/// whoosh in twelve places costs what dropping it once does.
struct WaveformSource: Hashable, Sendable {
    let key: String
    let url: URL
    let duration: Double
}

extension WaveformSource {
    init(media: ProjectMedia) {
        self.init(key: media.id.uuidString, url: media.url, duration: media.duration)
    }

    /// Keyed by the file, not by the layer: the same effect placed twice is one
    /// waveform. The whole file is measured however little of it is used, so
    /// trimming an effect shorter and pulling it back out again never waits for
    /// a second decode.
    init(audio layer: ProjectAudioLayer) {
        self.init(
            key: Self.fileKey(for: layer.url),
            url: layer.url,
            duration: max(layer.sourceStart + layer.duration, layer.sourceDuration ?? 0)
        )
    }

    /// A digest of the path, because the path itself is not a file name. FNV-1a
    /// rather than `hashValue`, which is seeded per launch and would abandon
    /// yesterday's cache entry every time the app opens.
    static func fileKey(for url: URL) -> String {
        var hash: UInt64 = 0xcbf2_9ce4_8422_2325
        for byte in url.standardizedFileURL.path.utf8 {
            hash ^= UInt64(byte)
            hash &*= 0x0000_0100_0000_01b3
        }
        return String(hash, radix: 36)
    }
}
