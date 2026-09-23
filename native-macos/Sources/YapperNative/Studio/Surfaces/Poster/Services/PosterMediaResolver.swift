import Foundation

/// Signed, playable URLs for a video's master. A Yapper take resolves its key
/// through its submission first. Signed URLs are kept for a few minutes so a
/// grid of thumbnails and the open cover studio share one lookup.
actor PosterMediaResolver {
    static let shared = PosterMediaResolver()

    private var cache: [PosterMediaRef: (url: URL, at: Date)] = [:]
    private var inFlight: [PosterMediaRef: Task<URL, Error>] = [:]

    func url(for media: PosterMediaRef) async throws -> URL {
        if let hit = cache[media], Date().timeIntervalSince(hit.at) < 240 { return hit.url }
        if let task = inFlight[media] { return try await task.value }
        let task = Task { try await Self.resolve(media) }
        inFlight[media] = task
        defer { inFlight[media] = nil }
        let url = try await task.value
        cache[media] = (url, Date())
        return url
    }

    /// The storage key behind a video, for routes that take one.
    static func key(for media: PosterMediaRef) async throws -> String {
        if let key = media.mediaKey { return key }
        guard let submission = media.submissionID, !submission.isEmpty else { throw PosterUploadFailure("video_unavailable") }
        let envelope: PosterSubmissionEnvelope = try await PosterHTTP.get("api/submissions/\(submission)")
        guard let key = envelope.submission.mediaKey else { throw PosterUploadFailure("video_unavailable") }
        return key
    }

    private static func resolve(_ media: PosterMediaRef) async throws -> URL {
        let key = try await key(for: media)
        let encoded = key.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? key
        let signed: PosterSignedURL = try await PosterHTTP.get("api/media/sign?key=\(encoded)")
        guard let url = URL(string: signed.url) else { throw PosterUploadFailure("video_unavailable") }
        return url
    }
}
