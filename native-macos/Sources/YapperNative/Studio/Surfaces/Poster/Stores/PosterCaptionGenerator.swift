import Foundation

/// Drafting captions for the open video: one request, its status, and the
/// transcripts already heard. Results go to the draft store.
@MainActor
final class PosterCaptionGenerator: ObservableObject {
    static let shared = PosterCaptionGenerator()

    @Published private(set) var generating = false
    @Published private(set) var reading = false
    @Published private(set) var error: String?
    private var transcripts: [String: String] = [:]

    func generate(
        for video: PosterVideo,
        platforms: [PublishPlatform],
        brief: String,
        titleOnly: Bool,
        into drafts: PosterDraftStore
    ) async {
        guard !platforms.isEmpty, !generating else { return }
        generating = true
        error = nil
        defer { generating = false }
        do {
            var transcript: String?
            if let key = video.mediaKey {
                transcript = try await hear(key)
            }
            let response: PosterCaptionResponse = try await PosterHTTP.post("api/publish/caption", body: .compact([
                "title": video.title,
                "platforms": platforms.map(\.rawValue),
                "contentItemId": video.contentItemID,
                "matchStyle": true,
                "transcript": transcript,
                "sourceCaption": video.sourceCaption,
                "requireTranscript": video.mediaKey != nil,
                "titleOnly": titleOnly,
                "instructions": brief,
            ]))
            drafts.applyGenerated(response.captions, to: video.id, titleOnly: titleOnly, sourceCaption: video.sourceCaption ?? "")
        } catch let failure as PosterMessage {
            error = failure.text
        } catch let failure as PosterHTTPError {
            error = failure.status == 501
                ? "AI captions aren't set up yet."
                : failure.status == 402 || failure.status == 429 ? failure.message
                : "Caption generation failed. Your existing text is safe."
        } catch {
            self.error = "Caption generation failed. Your existing text is safe."
        }
    }

    /// A channel post has no library script, so its master is heard first.
    private func hear(_ key: String) async throws -> String {
        if let cached = transcripts[key] { return cached }
        reading = true
        defer { reading = false }
        guard let result: PosterTranscript = try? await PosterHTTP.post("api/transcribe", body: ["mediaKey": key]),
              !result.text.isEmpty
        else {
            throw PosterMessage("The video could not be transcribed. Your original caption is safe. Try again before generating.")
        }
        transcripts[key] = result.text
        return result.text
    }
}
