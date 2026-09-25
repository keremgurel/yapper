import Foundation

/// Sends one voice take to `/api/transcribe` and returns the words, the way
/// the web composer does: small takes go in the request body, larger ones go
/// to storage through `/api/transcribe/upload-url` first.
enum DictationTranscriber {
    static let contentType = "audio/mp4"
    /// Just under the hosting platform's request body limit.
    static let directUploadBytes = 3_900_000

    struct Ticket: Decodable {
        let key: String
        let url: String
    }

    struct Reply: Decodable {
        struct Word: Decodable { let text: String }
        let words: [Word]?

        var text: String {
            (words ?? []).map(\.text).joined(separator: " ").ideasTrimmed
        }
    }

    private struct TicketRequest: Encodable {
        let bytes: Int
        let contentType: String
    }

    private struct StoredTake: Encodable {
        let key: String
        let contentType: String
    }

    /// The file is removed only once its words are back, so a take that
    /// fails to transcribe can be sent again.
    static func transcribe(_ file: URL) async throws -> String {
        let audio = try Data(contentsOf: file)
        let reply: Data
        if audio.count > directUploadBytes {
            let ticket: Ticket = try await StudioJSONClient.post(
                "api/transcribe/upload-url", body: TicketRequest(bytes: audio.count, contentType: contentType)
            )
            try await put(audio, to: ticket.url)
            let body = try JSONEncoder().encode(StoredTake(key: ticket.key, contentType: contentType))
            reply = try await StudioJSONClient.raw("api/transcribe", method: "POST", body: body)
        } else {
            reply = try await StudioJSONClient.raw("api/transcribe", method: "POST", body: audio, contentType: contentType)
        }
        let text = try JSONDecoder().decode(Reply.self, from: reply).text
        try? FileManager.default.removeItem(at: file)
        return text
    }

    private static func put(_ audio: Data, to target: String) async throws {
        guard let url = URL(string: target) else { throw DictationError.transcribeFailed }
        var request = URLRequest(url: url)
        request.httpMethod = "PUT"
        request.setValue(contentType, forHTTPHeaderField: "Content-Type")
        let (_, response) = try await URLSession.shared.upload(for: request, from: audio)
        guard let status = (response as? HTTPURLResponse)?.statusCode, (200..<300).contains(status) else {
            throw DictationError.transcribeFailed
        }
    }
}
