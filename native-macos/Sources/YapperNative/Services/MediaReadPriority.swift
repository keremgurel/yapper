import Foundation

/// Streaming a camera import and seeking through its audio at the same time
/// can turn each read into a disk seek. Give the foreground decode the drive
/// until it finishes, then let the open import file resume at its current offset.
final class MediaReadPriority: @unchecked Sendable {
    static let shared = MediaReadPriority()
    private let lock = NSLock()
    private var audioReaders: [URL: Int] = [:]

    static func volume(containing file: URL) -> URL {
        let volume = try? file.resourceValues(forKeys: [.volumeURLKey]).volume
        return (volume ?? file).standardizedFileURL
    }

    func withAudioRead<Result>(
        from file: URL, isolation: isolated (any Actor)? = #isolation,
        _ read: () async throws -> Result
    ) async rethrows -> Result {
        let volume = Self.volume(containing: file)
        lock.withLock { audioReaders[volume, default: 0] += 1 }
        defer {
            lock.withLock {
                if audioReaders[volume] == 1 { audioReaders.removeValue(forKey: volume) }
                else { audioReaders[volume]? -= 1 }
            }
        }
        return try await read()
    }

    func waitToCopy(on volume: URL) async throws {
        try Task.checkCancellation()
        while lock.withLock({ audioReaders[volume] != nil }) {
            try await Task.sleep(for: .milliseconds(80))
        }
    }
}
