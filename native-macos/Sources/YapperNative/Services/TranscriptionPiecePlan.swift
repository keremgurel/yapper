import Foundation

/// How a take is cut into pieces before it is uploaded for transcription.
///
/// The right length depends on which transcriber the service offers a take to
/// first: one drops repeated attempts on long audio and wants short pieces
/// that overlap, another is at its best on long ones. That choice is made on
/// the service, so the editor asks for the plan instead of assuming it.
struct TranscriptionPiecePlan: Equatable, Sendable, Decodable {
    let pieceSeconds: Double
    let overlapSeconds: Double

    /// Short overlapping pieces. Every transcriber can work with these, so
    /// this is what the editor uses when the service gives no usable answer.
    static let overlapping = TranscriptionPiecePlan(pieceSeconds: 120, overlapSeconds: 30)

    /// The plan, or nil when it is outside what the transcription route
    /// accepts: a piece of at most ten minutes, with an overlap shorter than
    /// half the piece so every piece still advances.
    var validated: TranscriptionPiecePlan? {
        guard pieceSeconds.isFinite, overlapSeconds.isFinite,
              (30 ... 600).contains(pieceSeconds),
              overlapSeconds >= 0, overlapSeconds <= min(60, pieceSeconds / 2)
        else { return nil }
        return self
    }

    /// What the service answered, read leniently: anything that is not a
    /// usable plan means the overlapping pieces.
    static func decoded(from data: Data) -> TranscriptionPiecePlan {
        (try? JSONDecoder().decode(TranscriptionPiecePlan.self, from: data))?.validated ?? .overlapping
    }

    /// Asks the service which plan to use. Never throws and never waits long:
    /// a slow or older service must not hold up an edit, and the overlapping
    /// pieces are always acceptable.
    static func current(baseURL: URL) async -> TranscriptionPiecePlan {
        var request = await YapperAPI.authenticatedRequest(url: baseURL.appending(path: "api/transcribe/plan"))
        request.httpMethod = "GET"
        request.timeoutInterval = 4
        guard let (data, response) = try? await URLSession.shared.data(for: request),
              let http = response as? HTTPURLResponse, http.statusCode == 200
        else { return .overlapping }
        return decoded(from: data)
    }
}
