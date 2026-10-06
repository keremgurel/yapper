import CryptoKit
import Foundation

/// One cached final master per saved revision. Merely listing projects never
/// exports them; selecting one prepares it locally without an upload round trip.
actor PosterProjectRender {
    static let shared = PosterProjectRender()
    private var inFlight: [String: Task<URL, Error>] = [:]
    private var projectTasks: [UUID: [String: Task<URL, Error>]] = [:]
    private var lastRender: Task<URL, Error>?

    static func revision(_ project: EditorProject) throws -> String {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        var renderInput = project
        renderInput.name = ""
        renderInput.createdAt = Date(timeIntervalSince1970: 0)
        renderInput.updatedAt = Date(timeIntervalSince1970: 0)
        renderInput.studioSource = nil
        // A byte-identical owned copy is the same edit. Preserve its original
        // identity so importing into local storage does not trigger another export.
        var imports: [URL: ManagedProjectMedia.Receipt] = [:]
        for i in renderInput.media.indices where renderInput.media[i].packagedSource == true {
            let media = renderInput.media[i]
            if let receipt = ManagedProjectMedia.importReceipt(for: media.id, managedURL: media.url, fingerprint: media.sourceFingerprint) {
                imports[media.url] = receipt
                renderInput.media[i].url = receipt.source
                renderInput.media[i].packagedSource = nil
            }
        }
        for i in renderInput.audioLayers?.indices ?? 0..<0 {
            guard let layer = renderInput.audioLayers?[i], let id = layer.packagedMediaID,
                  let receipt = ManagedProjectMedia.importReceipt(for: id, managedURL: layer.url, fingerprint: layer.sourceFingerprint) else { continue }
            imports[layer.url] = receipt
            renderInput.audioLayers?[i].url = receipt.source
            renderInput.audioLayers?[i].packagedMediaID = nil
        }
        var data = Data("poster-1080-v1".utf8)
        data.append(try encoder.encode(renderInput))
        // Same-path source replacements must not reuse an older render.
        let urls = project.media.map(\.url) + (project.audioLayers ?? []).map(\.url)
        let identities = renderInput.media.map(\.url) + (renderInput.audioLayers ?? []).map(\.url)
        for (identity, url) in zip(identities, urls).sorted(by: { $0.0.path < $1.0.path }) {
            let values = try? url.resourceValues(forKeys: [.fileSizeKey, .contentModificationDateKey])
            var modified = values?.contentModificationDate
            if let receipt = imports[url], receipt.bytes == values?.fileSize,
               modified == (receipt.managedModified ?? receipt.modified) {
                // Filesystems can round modification times when copying. The
                // receipt ties the unchanged owned file to its original metadata.
                modified = receipt.modified
            }
            data.append(Data("\(identity.path):\(values?.fileSize ?? -1):\(modified?.timeIntervalSince1970 ?? -1)".utf8))
        }
        return SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
    }

    func cancel(projectID: UUID) async {
        let tasks = projectTasks.removeValue(forKey: projectID) ?? [:]
        for task in tasks.values { task.cancel() }
        for task in tasks.values { _ = try? await task.value }
    }

    func cached(_ listing: ProjectListing) async -> URL? {
        guard let project = try? await ProjectPackageStore(package: listing.package).load(),
              let revision = try? Self.revision(project) else { return nil }
        let file = ProjectStore.directory.appending(path: "Poster renders/\(project.id.uuidString)/\(revision).mp4")
        return FileManager.default.fileExists(atPath: file.path) ? file : nil
    }

    func render(_ listing: ProjectListing) async throws -> URL {
        guard let project = try await ProjectPackageStore(package: listing.package).load(), !project.clips.isEmpty else {
            throw NativeEditorError.exportFailed("Open this project in Editor and add a clip first.")
        }
        let revision = try Self.revision(project)
        let directory = ProjectStore.directory.appending(path: "Poster renders/\(project.id.uuidString)")
        let output = directory.appending(path: "\(revision).mp4")
        if FileManager.default.fileExists(atPath: output.path) { return output }
        if let task = inFlight[revision] { return try await task.value }
        let previous = lastRender
        let task = Task {
            // Avoid competing full-resolution exports when selection changes rapidly.
            _ = try? await previous?.value
            try Task.checkCancellation()
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            try await ExportService.export(project: project, to: output, maximumRenderDimension: 1920)
            return output
        }
        projectTasks[project.id, default: [:]][revision] = task
        inFlight[revision] = task
        lastRender = task
        defer { inFlight[revision] = nil; projectTasks[project.id]?[revision] = nil }
        return try await task.value
    }
}
