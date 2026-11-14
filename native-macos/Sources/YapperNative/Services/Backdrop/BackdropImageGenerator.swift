import Foundation

/// Makes a backdrop picture from a sentence, through the same image route the
/// Poster's AI thumbnails use (`api/publish/thumbnail`), which answers with a
/// 9:16 picture at 1152 by 2048. It is charged the same way: one AI thumbnail
/// credit, refunded by the server when generation fails.
enum BackdropImageGenerator {
    struct Failure: LocalizedError {
        let message: String
        var errorDescription: String? { message }
    }

    /// What is sent: the creator's words, wrapped so the picture works behind
    /// a card under white captions rather than as a thumbnail.
    static func prompt(for request: String) -> String {
        """
        A background plate for a vertical 9:16 talking-head video. It sits full frame behind a UI card \
        and under white captions. Subject: \(request.trimmingCharacters(in: .whitespacesAndNewlines)).
        Calm and soft, slightly dark, gently out of focus, low contrast. No text, no letters, no logos, \
        no people, no faces, no UI. Keep the lower third of the frame dark and plain.
        """
    }

    /// Generates the picture and writes it to a temporary PNG, ready to import.
    static func generate(_ request: String) async throws -> URL {
        let result: PosterGeneratedThumbnail
        do {
            result = try await PosterHTTP.post(
                "api/publish/thumbnail",
                body: ["prompt": prompt(for: request)],
                timeout: 250
            )
        } catch let failure as PosterHTTPError {
            let message = switch failure.code {
            case "insufficient_credits": "You are out of credits for this month."
            case "not_entitled": "AI backgrounds need an active membership."
            case "unauthorized": "Sign in to generate a background."
            default: "The background could not be generated. Try again."
            }
            throw Failure(message: message)
        }
        guard
            let comma = result.image.firstIndex(of: ","),
            let data = Data(base64Encoded: String(result.image[result.image.index(after: comma)...]))
        else { throw Failure(message: "The background came back unreadable. Try again.") }
        let ext = result.image.hasPrefix("data:image/jpeg") ? "jpg" : result.image.hasPrefix("data:image/webp") ? "webp" : "png"
        let url = FileManager.default.temporaryDirectory
            .appending(path: "Backdrop \(fileName(for: request)).\(ext)")
        try data.write(to: url, options: .atomic)
        return url
    }

    /// A short, safe name from the prompt, so the picture is findable in Media.
    static func fileName(for request: String) -> String {
        let words = request
            .components(separatedBy: CharacterSet.alphanumerics.inverted)
            .filter { !$0.isEmpty }
            .prefix(6)
            .joined(separator: " ")
        return words.isEmpty ? UUID().uuidString.prefix(8).lowercased() : words
    }
}
