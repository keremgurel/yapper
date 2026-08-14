@preconcurrency import AVFoundation
import CryptoKit
import Foundation

/// Brings a file into the library: hashes it, copies it, and asks it how long
/// it is.
///
/// An actor because a music bed is tens of megabytes and none of that work
/// belongs on the main thread while the page it came from is still animating.
/// It owns no state, which is the point: the store decides what the library
/// contains, this only knows how to turn a URL on disk into a `SavedAudio`.
actor AudioLibraryImporter {
    static let shared = AudioLibraryImporter()

    /// What went wrong with one file, so a batch import can report the file
    /// that failed instead of failing silently around it.
    struct Failure: Error {
        let url: URL
        let reason: String
    }

    /// - Parameter taken: file names already in the folder, so two sounds that
    ///   were both called `pop.mp3` do not become one.
    /// - Returns: the item to record, or nil when this file is already saved.
    func importFile(
        at source: URL,
        taken: Set<String>,
        existingHashes: Set<String>
    ) async throws -> SavedAudio? {
        let source = source.resolvingSymlinksInPath()
        let hash = try AudioContentHash.compute(url: source)
        // Re-importing the same file is something people do constantly, by
        // dragging the same folder in twice. It is not an error and it must not
        // make a second copy.
        guard !existingHashes.contains(hash) else { return nil }

        let asset = AVURLAsset(url: source)
        guard try await asset.loadTracks(withMediaType: .audio).first != nil else {
            throw Failure(url: source, reason: "\(source.lastPathComponent) has no audio in it.")
        }
        let duration = try await asset.load(.duration).seconds
        guard duration.isFinite, duration > 0 else {
            throw Failure(url: source, reason: "\(source.lastPathComponent) is empty.")
        }

        AudioLibraryFolder.ensureExists()
        let fileName = AudioLibraryNaming.uniqueFileName(for: source, taken: taken)
        let destination = AudioLibraryFolder.fileURL(named: fileName)
        do {
            try FileManager.default.copyItem(at: source, to: destination)
        } catch {
            throw Failure(url: source, reason: error.localizedDescription)
        }

        return SavedAudio(
            name: AudioLibraryNaming.displayName(for: source),
            kind: SavedAudioKind.guessed(fromDuration: duration),
            fileName: fileName,
            duration: duration,
            contentHash: hash
        )
    }

}

enum AudioContentHash {
    /// SHA-256 of the bytes, read in chunks so importing an hour of music does
    /// not put an hour of music in memory.
    static func compute(
        url: URL,
        beforeRead: (@Sendable () throws -> Void)? = nil
    ) throws -> String {
        let handle = try FileHandle(forReadingFrom: url)
        defer { try? handle.close() }
        var hasher = SHA256()
        while let chunk = try handle.read(upToCount: 1 << 20), !chunk.isEmpty {
            try Task.checkCancellation()
            try beforeRead?()
            hasher.update(data: chunk)
        }
        return hasher.finalize().map { String(format: "%02x", $0) }.joined()
    }

    static func computeAsync(
        url: URL,
        beforeRead: (@Sendable () throws -> Void)? = nil
    ) async throws -> String {
        let work = Task.detached { try compute(url: url, beforeRead: beforeRead) }
        return try await withTaskCancellationHandler {
            try await work.value
        } onCancel: {
            work.cancel()
        }
    }
}
