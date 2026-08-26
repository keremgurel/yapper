import Foundation

enum PosterHandoffStage: Sendable {
    case uploading
    case registering
    case transcribing
}

enum PosterHandoffError: LocalizedError {
    case invalidExport
    case invalidResponse
    case requestFailed(Int, Data)

    var errorDescription: String? {
        switch self {
        case .invalidExport: "The exported video could not be read."
        case .invalidResponse: "Poster returned an unreadable response."
        case let .requestFailed(status, data):
            YapperAPI.failure(status: status, body: data, action: "Preparing the post").errorDescription
        }
    }
}

/// Sends one native editor export into the same durable Poster library used by
/// the web uploader. The file is uploaded once, registered once, then heard
/// from that stored master so caption generation is grounded in the edit that
/// will actually be published.
enum PosterHandoffService {
    private struct UploadTicket: Decodable { let url: URL; let key: String }
    private struct SubmissionEnvelope: Decodable {
        struct Submission: Decodable { let id: String }
        let submission: Submission
    }
    private struct ContentEnvelope: Decodable {
        struct Item: Decodable { let id: String }
        let item: Item
    }
    private struct TranscriptEnvelope: Decodable {
        struct Word: Decodable { let text: String? }
        let words: [Word]
    }

    static func prepare(
        exportURL: URL,
        title: String,
        stage: @escaping @MainActor (PosterHandoffStage) -> Void
    ) async throws -> String {
        let values = try exportURL.resourceValues(forKeys: [.fileSizeKey, .isRegularFileKey])
        guard values.isRegularFile == true, let bytes = values.fileSize, bytes > 0 else {
            throw PosterHandoffError.invalidExport
        }

        await stage(.uploading)
        let ticket: UploadTicket = try await jsonRequest(
            path: "api/media/upload-url",
            body: [
                "sizeBytes": bytes,
                "mimeType": "video/mp4",
                "ext": "mp4",
                "purpose": "recording",
            ]
        )
        var upload = URLRequest(url: ticket.url)
        upload.httpMethod = "PUT"
        upload.setValue("video/mp4", forHTTPHeaderField: "Content-Type")
        let (uploadData, uploadResponse) = try await URLSession.shared.upload(
            for: upload,
            fromFile: exportURL
        )
        try requireSuccess(uploadResponse, body: uploadData)

        await stage(.registering)
        let registered: SubmissionEnvelope = try await jsonRequest(
            path: "api/submissions",
            body: ["mediaKey": ticket.key, "title": title]
        )
        let content: ContentEnvelope = try await jsonRequest(
            path: "api/content",
            body: [
                "title": title,
                "submissionId": registered.submission.id,
                "sourceUrl": "yapper://poster-upload",
                "sourceTitle": "Native editor export",
                "transcriptStatus": "pending",
            ]
        )

        await stage(.transcribing)
        do {
            let transcript: TranscriptEnvelope = try await jsonRequest(
                path: "api/transcribe",
                body: ["submissionId": registered.submission.id]
            )
            let text = transcript.words
                .compactMap(\.text)
                .joined(separator: " ")
                .split(whereSeparator: \.isWhitespace)
                .joined(separator: " ")
            guard !text.isEmpty else { throw PosterHandoffError.invalidResponse }
            let _: ContentEnvelope = try await jsonRequest(
                path: "api/content/\(content.item.id)",
                method: "PATCH",
                body: ["sourceTranscript": text, "transcriptStatus": "ready"]
            )
        } catch {
            // The stored export is still completely usable. Poster names the
            // fallback honestly and generates from the title + editable brief.
            let _: ContentEnvelope? = try? await jsonRequest(
                path: "api/content/\(content.item.id)",
                method: "PATCH",
                body: ["transcriptStatus": "unavailable"]
            )
        }
        return content.item.id
    }

    private static func jsonRequest<Response: Decodable>(
        path: String,
        method: String = "POST",
        body: [String: Any]
    ) async throws -> Response {
        var request = await YapperAPI.authenticatedRequest(url: YapperAPI.url(path: path))
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await URLSession.shared.data(for: request)
        try requireSuccess(response, body: data)
        guard let decoded = try? JSONDecoder().decode(Response.self, from: data) else {
            throw PosterHandoffError.invalidResponse
        }
        return decoded
    }

    private static func requireSuccess(_ response: URLResponse, body: Data) throws {
        guard let http = response as? HTTPURLResponse else {
            throw PosterHandoffError.invalidResponse
        }
        guard (200 ..< 300).contains(http.statusCode) else {
            throw PosterHandoffError.requestFailed(http.statusCode, body)
        }
    }
}
