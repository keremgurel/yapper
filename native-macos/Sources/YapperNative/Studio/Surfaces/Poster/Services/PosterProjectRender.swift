import CryptoKit
import Foundation

/// One cached final master per saved revision. Merely listing projects never
/// exports them; selecting one prepares it locally without an upload round trip.
actor PosterProjectRender {
    static let shared = PosterProjectRender()
    private var inFlight: [String: Task<URL, Error>] = [:]
    private var lastRender: Task<URL, Error>?

    static func revision(_ project: EditorProject) throws -> String {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        var renderInput = project
        renderInput.name = ""
        renderInput.createdAt = Date(timeIntervalSince1970: 0)
        renderInput.updatedAt = Date(timeIntervalSince1970: 0)
        renderInput.studioSource = nil
        var data = Data("poster-1080-v1".utf8)
        data.append(try encoder.encode(renderInput))
        // Same-path source replacements must not reuse an older render.
        let urls = project.media.map(\.url) + (project.audioLayers ?? []).map(\.url)
        for url in urls.sorted(by: { $0.path < $1.path }) {
            let values = try? url.resourceValues(forKeys: [.fileSizeKey, .contentModificationDateKey])
            data.append(Data("\(url.path):\(values?.fileSize ?? -1):\(values?.contentModificationDate?.timeIntervalSince1970 ?? -1)".utf8))
        }
        return SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
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
        inFlight[revision] = task
        lastRender = task
        defer { inFlight[revision] = nil }
        return try await task.value
    }
}
