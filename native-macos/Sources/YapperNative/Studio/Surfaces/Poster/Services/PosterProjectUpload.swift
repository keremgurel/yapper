import Foundation

/// A rendered master transfers once. The timed edit transcript transfers with
/// it, so publishing never waits for a second transcription of the same video.
enum PosterProjectUpload {
    static func prepare(_ file: URL, project: EditorProject, userID: String,
                        progress: @escaping @Sendable (Double) -> Void) async throws -> PosterContentItem {
        try await requireAccount(userID)
        let bytes = try file.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
        guard bytes > 0 else { throw PosterHandoffError.invalidExport }
        let ticket: PosterUploadTicket = try await PosterHTTP.post("api/media/upload-url", body: [
            "sizeBytes": bytes, "mimeType": "video/mp4", "ext": "mp4", "purpose": "recording",
            "projectId": project.id.uuidString.lowercased(),
        ])
        try await requireAccount(userID)
        guard let url = URL(string: ticket.url) else { throw PosterHandoffError.invalidResponse }
        try await PosterFileUpload.put(file: file, to: url, mimeType: "video/mp4", progress: progress)
        try await requireAccount(userID)
        let submission: PosterSubmissionEnvelope = try await PosterHTTP.post("api/submissions", body: [
            "mediaKey": ticket.key, "title": project.name,
        ])
        try await requireAccount(userID)
        return try await attach(submissionID: submission.submission.id, project: project,
                                revision: file.deletingPathExtension().lastPathComponent, userID: userID)
    }

    static func attach(submissionID: String, project: EditorProject, revision: String, userID: String) async throws -> PosterContentItem {
        try await requireAccount(userID)
        let content: PosterContentEnvelope = try await PosterHTTP.post("api/publish/projects", body: [
            "projectId": project.id.uuidString.lowercased(), "title": project.name,
            "submissionId": submissionID,
            "revision": revision,
            "editedAt": project.updatedAt.timeIntervalSince1970 * 1000,
            "transcript": TimelineInspectionService.timelineWords(project: project).map(\.text).joined(separator: " "),
        ])
        try await requireAccount(userID)
        return content.item
    }

    @MainActor private static func requireAccount(_ userID: String) throws {
        try Task.checkCancellation()
        guard StudioAuth.shared.account?.userID == userID else {
            throw NativeEditorError.exportFailed("Sign in to the same account to finish preparing this video.")
        }
    }
}
