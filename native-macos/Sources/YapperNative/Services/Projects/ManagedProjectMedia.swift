import Darwin
import Foundation

/// Sources belong to their project package. APFS clones share unchanged disk
/// blocks but remain independent files; other volumes use cancellable streaming.
/// A receipt is committed last, so interrupted copies never become sources.
enum ManagedProjectMedia {
    struct Source: Sendable {
        let id: UUID
        let url: URL
        var fingerprint: String? = nil
    }
    struct Receipt: Codable {
        let source: URL
        let bytes: Int
        let modified: Date?
        var fingerprint: String? = nil
    }

    static func sources(in project: EditorProject, package: ProjectPackage) -> [Source] {
        let media = project.media.filter { $0.packagedSource != true && $0.generated == nil }
            .map { Source(id: $0.id, url: $0.url, fingerprint: $0.sourceFingerprint) }
        let audio = (project.audioLayers ?? []).filter { $0.builtInID == nil && $0.packagedMediaID == nil }
            .map { Source(id: $0.id, url: $0.url, fingerprint: $0.sourceFingerprint) }
        return (media + audio).filter {
            $0.url.isFileURL && !$0.url.standardizedFileURL.path.hasPrefix(package.url.standardizedFileURL.path + "/")
        }
    }

    static func originalURL(for id: UUID, in package: ProjectPackage) -> URL? {
        guard let data = try? Data(contentsOf: receiptURL(id, in: package)),
              let receipt = try? JSONDecoder().decode(Receipt.self, from: data) else { return nil }
        guard let values = try? receipt.source.resourceValues(forKeys: [.fileSizeKey, .contentModificationDateKey]),
              values.fileSize == receipt.bytes, values.contentModificationDate == receipt.modified else { return nil }
        return receipt.source
    }

    static func receiptURL(_ id: UUID, in package: ProjectPackage) -> URL {
        package.url.appending(path: "recordings/\(id.uuidString).receipt.json")
    }

    static func resolved(_ source: Source, in package: ProjectPackage) -> URL? {
        guard let data = try? Data(contentsOf: receiptURL(source.id, in: package)),
              let receipt = try? JSONDecoder().decode(Receipt.self, from: data),
              receipt.source == source.url, receipt.fingerprint == source.fingerprint else { return nil }
        let target = PackagedMediaLayout.file(for: source.id, extension: source.url.pathExtension, in: package.url)
        guard let size = try? target.resourceValues(forKeys: [.fileSizeKey]).fileSize,
              size == receipt.bytes else { return nil }
        return target
    }

    /// Also applied on save: undo snapshots and late background edit results
    /// cannot restore an external URL after its managed copy has been committed.
    static func resolved(_ project: EditorProject, in package: ProjectPackage) -> EditorProject {
        var next = project
        for i in next.media.indices where next.media[i].packagedSource != true {
            if let target = resolved(Source(id: next.media[i].id, url: next.media[i].url, fingerprint: next.media[i].sourceFingerprint), in: package) {
                next.media[i].url = target
                next.media[i].packagedSource = true
            }
        }
        for i in next.audioLayers?.indices ?? 0..<0 {
            guard let layer = next.audioLayers?[i], layer.builtInID == nil, layer.packagedMediaID == nil,
                  let target = resolved(Source(id: layer.id, url: layer.url, fingerprint: layer.sourceFingerprint), in: package) else { continue }
            next.audioLayers?[i].url = target
            next.audioLayers?[i].packagedMediaID = layer.id
        }
        return next
    }

    static func copy(_ source: Source, into package: ProjectPackage, forceStreaming: Bool = false) async throws {
        let work = Task.detached(priority: .utility) {
            let access = source.url.startAccessingSecurityScopedResource()
            defer { if access { source.url.stopAccessingSecurityScopedResource() } }
            if let fingerprint = source.fingerprint, try await MediaSourceFingerprint.compute(url: source.url) != fingerprint {
                throw NativeEditorError.incompatibleMedia(source.url.lastPathComponent)
            }
            try copyFile(source, into: package, forceStreaming: forceStreaming)
        }
        try await withTaskCancellationHandler { try await work.value } onCancel: { work.cancel() }
    }

    private static func copyFile(_ source: Source, into package: ProjectPackage, forceStreaming: Bool) throws {
        try Task.checkCancellation()
        if resolved(source, in: package) != nil { return }
        let fm = FileManager.default
        // Do not recreate a project that was deleted or moved during import.
        guard fm.fileExists(atPath: package.projectFileURL.path) else { throw CancellationError() }
        let access = source.url.startAccessingSecurityScopedResource()
        defer { if access { source.url.stopAccessingSecurityScopedResource() } }
        let before = try source.url.resourceValues(forKeys: [.fileSizeKey, .contentModificationDateKey, .isRegularFileKey])
        guard before.isRegularFile == true, let bytes = before.fileSize else { throw CocoaError(.fileReadUnsupportedScheme) }
        let target = PackagedMediaLayout.file(for: source.id, extension: source.url.pathExtension, in: package.url)
        try fm.createDirectory(at: target.deletingLastPathComponent(), withIntermediateDirectories: true)
        let temporary = target.deletingLastPathComponent().appending(path: ".\(UUID().uuidString).importing")
        defer { try? fm.removeItem(at: temporary) }
        let cloned = !forceStreaming && clonefile(source.url.path, temporary.path, 0) == 0
        if !cloned {
            let free = try package.url.resourceValues(forKeys: [.volumeAvailableCapacityForImportantUsageKey]).volumeAvailableCapacityForImportantUsage
            if let free, free < Int64(bytes) + 100_000_000 {
                throw NSError(domain: "YapperMedia", code: 1, userInfo: [NSLocalizedDescriptionKey: "Not enough disk space to save \(source.url.lastPathComponent). Free up space, then retry. Your original is unchanged."])
            }
            fm.createFile(atPath: temporary.path, contents: nil)
            let input = try FileHandle(forReadingFrom: source.url)
            let output = try FileHandle(forWritingTo: temporary)
            defer { try? input.close(); try? output.close() }
            while true {
                try Task.checkCancellation()
                guard let data = try input.read(upToCount: 4 * 1024 * 1024), !data.isEmpty else { break }
                try output.write(contentsOf: data)
            }
            try output.synchronize()
        }
        try Task.checkCancellation()
        let after = try source.url.resourceValues(forKeys: [.fileSizeKey, .contentModificationDateKey])
        let copied = try temporary.resourceValues(forKeys: [.fileSizeKey]).fileSize
        guard before.fileSize == after.fileSize, before.contentModificationDate == after.contentModificationDate, copied == bytes else {
            throw NSError(domain: "YapperMedia", code: 2, userInfo: [NSLocalizedDescriptionKey: "The source changed while saving. Keep it connected and retry."])
        }
        guard fm.fileExists(atPath: package.projectFileURL.path) else { throw CancellationError() }
        // Never overwrite an existing managed original, including one retained
        // by undo. A replacement needs a distinct media identity.
        if fm.fileExists(atPath: target.path) {
            // Recover a crash between committing the bytes and their receipt.
            // A complete byte comparison is only needed on this recovery path.
            guard !fm.fileExists(atPath: receiptURL(source.id, in: package).path),
                  fm.contentsEqual(atPath: temporary.path, andPath: target.path) else {
                throw CocoaError(.fileWriteFileExists)
            }
        } else {
            try fm.moveItem(at: temporary, to: target)
        }
        do {
            let receipt = Receipt(source: source.url, bytes: bytes, modified: after.contentModificationDate, fingerprint: source.fingerprint)
            try JSONEncoder().encode(receipt).write(to: receiptURL(source.id, in: package), options: .atomic)
        } catch {
            try? fm.removeItem(at: target)
            throw error
        }
    }
}
