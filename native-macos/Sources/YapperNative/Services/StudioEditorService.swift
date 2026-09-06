import Foundation

enum StudioEditorError: LocalizedError {
    case unavailable
    case noRecording
    case invalidResponse
    case downloadFailed
    case busy

    var errorDescription: String? {
        switch self {
        case .unavailable: "This recording isn’t available in the signed-in account. Check the item in your Library and try again."
        case .noRecording: "Save a recording to this Library item before opening it in the editor."
        case .invalidResponse: "Studio couldn’t read this recording’s details. Try again."
        case .downloadFailed: "The recording couldn’t be downloaded. Check your connection and try again."
        case .busy: "Finish or cancel the current editor operation, then try opening this recording again."
        }
    }
}

struct StudioEditorRecording: Sendable {
    let source: StudioContentSource
    let title: String
    let url: URL
    let fileExtension: String
}

enum StudioEditorService {
    typealias Request = @Sendable (URL) async throws -> Data

    /// Each route enforces account ownership; signed media is resolved afresh.
    static func resolve(itemID: UUID, request: Request = authenticatedData) async throws -> StudioEditorRecording {
        struct ContentEnvelope: Decodable {
            struct Item: Decodable { let id: UUID; let title: String; let submissionId: UUID? }
            let item: Item
        }
        struct SubmissionEnvelope: Decodable {
            struct Submission: Decodable { let id: UUID; let userId: String; let mediaKey: String? }
            let submission: Submission
        }
        struct SignedMedia: Decodable { let url: URL }
        let decoder = JSONDecoder()
        let contentData = try await request(YapperAPI.url(path: "api/content/\(itemID.uuidString.lowercased())"))
        guard let content = try? decoder.decode(ContentEnvelope.self, from: contentData), content.item.id == itemID
        else { throw StudioEditorError.invalidResponse }
        guard let submissionID = content.item.submissionId else { throw StudioEditorError.noRecording }
        let submissionData = try await request(YapperAPI.url(path: "api/submissions/\(submissionID.uuidString.lowercased())"))
        guard let submission = (try? decoder.decode(SubmissionEnvelope.self, from: submissionData))?.submission,
              submission.id == submissionID, !submission.userId.isEmpty
        else { throw StudioEditorError.invalidResponse }
        guard let key = submission.mediaKey, !key.isEmpty else { throw StudioEditorError.noRecording }
        var components = URLComponents(url: YapperAPI.url(path: "api/media/sign"), resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "key", value: key)]
        let signedData = try await request(components.url!)
        guard let signed = try? decoder.decode(SignedMedia.self, from: signedData),
              signed.url.scheme == "https", signed.url.host != nil
        else { throw StudioEditorError.invalidResponse }
        let ext = (key as NSString).pathExtension.lowercased()
        guard ["mp4", "mov", "m4v", "webm"].contains(ext) else { throw StudioEditorError.invalidResponse }
        return StudioEditorRecording(
            source: StudioContentSource(userID: submission.userId, itemID: itemID, submissionID: submissionID),
            title: content.item.title.isEmpty ? "Studio recording" : content.item.title,
            url: signed.url,
            fileExtension: ext
        )
    }

    static func authenticatedData(_ url: URL) async throws -> Data {
        let request = await YapperAPI.authenticatedRequest(url: url)
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw StudioEditorError.invalidResponse }
        // Missing items are not expired authentication; do not sign the user out.
        if http.statusCode == 404 || http.statusCode == 409 { throw StudioEditorError.unavailable }
        guard (200 ..< 300).contains(http.statusCode) else {
            throw YapperAPI.failure(status: http.statusCode, body: data, action: "Opening the recording")
        }
        return data
    }

    /// Download to disk, keeping video bytes out of memory. Only a fully read,
    /// playable source becomes a saved project.
    static func prepare(_ recording: StudioEditorRecording, in library: ProjectLibrary) async throws -> ProjectPackage {
        let (temporary, response) = try await URLSession.shared.download(from: recording.url)
        defer { try? FileManager.default.removeItem(at: temporary) }
        guard let http = response as? HTTPURLResponse, (200 ..< 300).contains(http.statusCode),
              (try temporary.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0) > 0
        else { throw StudioEditorError.downloadFailed }
        return try await install(downloadedFile: temporary, recording: recording, in: library)
    }

    static func install(downloadedFile: URL, recording: StudioEditorRecording, in library: ProjectLibrary) async throws -> ProjectPackage {
        try Task.checkCancellation()
        let package = try await library.create(named: recording.title)
        do {
            let mediaID = UUID()
            let destination = PackagedMediaLayout.file(for: mediaID, extension: recording.fileExtension, in: package.url)
            try FileManager.default.createDirectory(at: destination.deletingLastPathComponent(), withIntermediateDirectories: true)
            try FileManager.default.copyItem(at: downloadedFile, to: destination)
            var media = try await MediaProbe.inspect(url: destination)
            guard !media.isImage, media.duration.isFinite, media.duration > 0 else { throw StudioEditorError.noRecording }
            media.id = mediaID
            media.packagedSource = true
            var project = EditorProject(name: recording.title, media: [media], clips: [
                TimelineClip(mediaID: media.id, sourceStart: 0, sourceEnd: media.duration),
            ])
            project.studioSource = recording.source
            try Task.checkCancellation()
            try await ProjectPackageStore(package: package).save(project)
            return package
        } catch {
            // This is only the new, incomplete package created by this attempt.
            try? FileManager.default.removeItem(at: package.url)
            throw error
        }
    }
}
