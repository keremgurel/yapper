import Darwin
import Foundation

typealias ExportSourceCopying = (URL, URL) async throws -> Void

/// A private, disk-backed view of every external file an export will read.
///
/// AVFoundation loads source bytes lazily, long after the project model has
/// been validated. Keeping the original URLs in an export therefore lets an
/// SD-card remount or same-path replacement change the footage underneath a
/// render already in progress. This snapshot rewrites only required sources to
/// unique temporary files and owns them until delivery finishes.
final class ExportSourceSnapshot: @unchecked Sendable {
    private static let directoryPrefix = "yapper-export-snapshot-"
    private static let staleAge: TimeInterval = 24 * 60 * 60

    let project: EditorProject
    private let directory: URL
    private let cleanupLock = NSLock()
    private var cleaned = false

    private init(project: EditorProject, directory: URL) {
        self.project = project
        self.directory = directory
    }

    deinit { discard() }

    func discard() {
        let shouldRemove = cleanupLock.withLock {
            guard !cleaned else { return false }
            cleaned = true
            return true
        }
        if shouldRemove { try? FileManager.default.removeItem(at: directory) }
    }

    static func create(
        project: EditorProject,
        root: URL = FileManager.default.temporaryDirectory,
        copy: @escaping ExportSourceCopying = { source, destination in
            try await copyFile(from: source, to: destination)
        }
    ) async throws -> ExportSourceSnapshot {
        await purgeStaleSnapshots(in: root)
        try Task.checkCancellation()
        let directory = root.appending(
            path: directoryPrefix + UUID().uuidString,
            directoryHint: .isDirectory
        )
        try FileManager.default.createDirectory(
            at: directory,
            withIntermediateDirectories: true
        )

        do {
            var result = project
            let requiredMedia = MediaAvailability.requiredMediaIDs(in: project)
            let requiredAudio = (project.audioLayers ?? []).filter {
                $0.builtInID == nil && MediaAvailability.isRequired($0, in: project)
            }

            var requests: [String: SnapshotRequest] = [:]
            for media in project.media where requiredMedia.contains(media.id) {
                let key = sourceKey(media.url)
                var request = requests[key] ?? SnapshotRequest(source: media.url)
                if let fingerprint = media.sourceFingerprint {
                    request.sampledFingerprints.insert(fingerprint)
                }
                requests[key] = request
            }
            for layer in requiredAudio {
                let key = sourceKey(layer.url)
                var request = requests[key] ?? SnapshotRequest(source: layer.url)
                if let fingerprint = layer.sourceFingerprint {
                    request.sampledFingerprints.insert(fingerprint)
                }
                if layer.sourceKind == .saved, let hash = layer.savedAudioHash {
                    request.exactHashes.insert(hash)
                }
                requests[key] = request
            }

            var destinations: [String: URL] = [:]
            for key in requests.keys.sorted() {
                try Task.checkCancellation()
                guard let request = requests[key],
                      MediaAvailability.isRegularReadableFile(request.source)
                else {
                    throw NativeEditorError.exportFailed(
                        "A required source disappeared while export was starting. Reconnect it and try again."
                    )
                }
                let before = try MediaResourceRevision(url: request.source, fingerprint: key)
                let suffix = request.source.pathExtension.isEmpty
                    ? ""
                    : ".\(request.source.pathExtension)"
                let destination = directory.appending(path: UUID().uuidString + suffix)
                try await copy(request.source, destination)
                try Task.checkCancellation()
                let after = try MediaResourceRevision(url: request.source, fingerprint: key)
                guard before == after else {
                    throw NativeEditorError.exportFailed(
                        "A source changed while export was starting. Try the export again."
                    )
                }
                try await validate(request, snapshotURL: destination)
                destinations[key] = destination
            }

            for index in result.media.indices where requiredMedia.contains(result.media[index].id) {
                result.media[index].url = destinations[sourceKey(result.media[index].url)]
                    ?? result.media[index].url
            }
            if var layers = result.audioLayers {
                for index in layers.indices where
                    layers[index].builtInID == nil && MediaAvailability.isRequired(layers[index], in: project)
                {
                    layers[index].url = destinations[sourceKey(layers[index].url)] ?? layers[index].url
                }
                result.audioLayers = layers
            }
            return ExportSourceSnapshot(project: result, directory: directory)
        } catch {
            try? FileManager.default.removeItem(at: directory)
            throw error
        }
    }

    private struct SnapshotRequest {
        let source: URL
        var sampledFingerprints: Set<String> = []
        var exactHashes: Set<String> = []
    }

    private static func sourceKey(_ url: URL) -> String {
        url.resolvingSymlinksInPath().standardizedFileURL.path
    }

    private static func purgeStaleSnapshots(in root: URL, now: Date = Date()) async {
        let work = Task.detached(priority: .utility) {
            let keys: Set<URLResourceKey> = [.isDirectoryKey, .contentModificationDateKey]
            guard let entries = try? FileManager.default.contentsOfDirectory(
                at: root,
                includingPropertiesForKeys: Array(keys),
                options: [.skipsHiddenFiles]
            ) else { return }
            for entry in entries where entry.lastPathComponent.hasPrefix(directoryPrefix) {
                try Task.checkCancellation()
                guard let values = try? entry.resourceValues(forKeys: keys),
                      values.isDirectory == true,
                      let modified = values.contentModificationDate,
                      now.timeIntervalSince(modified) >= staleAge
                else { continue }
                try? FileManager.default.removeItem(at: entry)
            }
        }
        await withTaskCancellationHandler {
            _ = await work.result
        } onCancel: {
            work.cancel()
        }
    }

    private static func validate(
        _ request: SnapshotRequest,
        snapshotURL: URL
    ) async throws {
        if !request.sampledFingerprints.isEmpty {
            let actual = try await MediaSourceFingerprint.compute(url: snapshotURL)
            guard request.sampledFingerprints == Set([actual]) else {
                throw NativeEditorError.exportFailed(
                    "A required source no longer matches this project. Reconnect the original and try again."
                )
            }
        }
        if !request.exactHashes.isEmpty {
            let actual = try await AudioContentHash.computeAsync(url: snapshotURL)
            guard request.exactHashes == Set([actual]) else {
                throw NativeEditorError.exportFailed(
                    "A saved sound changed on disk. Restore or relink it before exporting."
                )
            }
        }
    }

    private static func copyFile(from source: URL, to destination: URL) async throws {
        let work = Task.detached(priority: .utility) {
            do {
                // APFS clones are independent copy-on-write files: effectively
                // instant for camera footage, while later writes to the source
                // cannot alter the snapshot. Cross-volume and non-APFS sources
                // fall back to the bounded streaming copy below.
                let cloned = source.withUnsafeFileSystemRepresentation { sourcePath in
                    destination.withUnsafeFileSystemRepresentation { destinationPath in
                        guard let sourcePath, let destinationPath else { return false }
                        return clonefile(sourcePath, destinationPath, 0) == 0
                    }
                }
                if cloned {
                    try Task.checkCancellation()
                    return
                }
                try? FileManager.default.removeItem(at: destination)
                guard FileManager.default.createFile(atPath: destination.path, contents: nil) else {
                    throw CocoaError(.fileWriteUnknown)
                }
                let input = try FileHandle(forReadingFrom: source)
                let output = try FileHandle(forWritingTo: destination)
                defer {
                    try? input.close()
                    try? output.close()
                }
                while true {
                    try Task.checkCancellation()
                    guard let chunk = try input.read(upToCount: 4 * 1024 * 1024),
                          !chunk.isEmpty
                    else { break }
                    try output.write(contentsOf: chunk)
                }
                try output.synchronize()
                try Task.checkCancellation()
            } catch {
                try? FileManager.default.removeItem(at: destination)
                throw error
            }
        }
        return try await withTaskCancellationHandler {
            try await work.value
        } onCancel: {
            work.cancel()
        }
    }
}
