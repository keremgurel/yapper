import Foundation

/// Saves one take to the library the way the web recorder does: allocate an
/// upload, PUT the file, register the submission, then link it to the idea.
///
/// Finished steps are kept, so a retry after a failure picks up where the
/// last attempt stopped instead of uploading the same take twice.
@MainActor
final class RecorderTakeUploader {
    let take: RecorderTake
    let itemID: String?
    let title: String?

    private var ticket: RecorderUploadTicket?
    private var uploaded = false
    private var submissionID: String?
    private var savedItemID: String?
    private var linked = false

    init(take: RecorderTake, itemID: String?, title: String?) {
        self.take = take
        self.itemID = itemID
        self.title = title
    }

    /// Runs the remaining steps and returns the library item the take is on.
    func save() async throws -> String {
        if linked, let savedItemID { return savedItemID }
        let ticket = try await allocate()
        if !uploaded { try await put(to: ticket) }
        if submissionID == nil { try await register(ticket) }
        guard let submissionID, let savedItemID else { throw RecorderSaveError.failed }
        if let itemID {
            try await StudioJSONClient.raw(
                "api/content/\(itemID)", method: "PATCH",
                body: try StudioJSONClient.encoder.encode(RecorderLinkRequest(submissionId: submissionID))
            )
        }
        linked = true
        return savedItemID
    }

    private func allocate() async throws -> RecorderUploadTicket {
        if let ticket { return ticket }
        let request = RecorderUploadRequest(sizeBytes: take.sizeBytes, mimeType: take.mimeType, ext: take.fileExtension)
        let fresh: RecorderUploadTicket = try await StudioJSONClient.post("api/media/upload-url", body: request)
        ticket = fresh
        return fresh
    }

    private func put(to ticket: RecorderUploadTicket) async throws {
        guard let url = URL(string: ticket.url) else { throw RecorderSaveError.failed }
        var request = URLRequest(url: url)
        request.httpMethod = "PUT"
        request.setValue(take.mimeType, forHTTPHeaderField: "Content-Type")
        let response: URLResponse
        do {
            (_, response) = try await URLSession.shared.upload(for: request, fromFile: take.url)
        } catch {
            throw RecorderSaveError.failed
        }
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else {
            // An expired signature needs a fresh allocation; anything else
            // can retry the same object while it is still valid.
            if status == 401 || status == 403 { self.ticket = nil }
            throw RecorderSaveError.failed
        }
        uploaded = true
    }

    private func register(_ ticket: RecorderUploadTicket) async throws {
        let body = RecorderSubmissionRequest(
            mediaKey: ticket.key,
            title: title,
            createLibraryItem: itemID == nil ? true : nil
        )
        let envelope: RecorderSubmissionEnvelope
        do {
            envelope = try await StudioJSONClient.post("api/submissions", body: body)
        } catch let error as StudioAPIError {
            if error.status == 404 {
                // The pending upload can expire while a failed save waits.
                self.ticket = nil
                uploaded = false
            }
            throw error
        }
        guard itemID != nil || envelope.submission.contentItemId != nil else { throw RecorderSaveError.failed }
        submissionID = envelope.submission.id
        savedItemID = itemID ?? envelope.submission.contentItemId
    }
}
