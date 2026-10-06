import Foundation

/// Drafting captions for the open video: one request, its status, and the
/// transcripts already heard. Results go to the draft store.
@MainActor
final class PosterCaptionGenerator: ObservableObject {
    static let shared = PosterCaptionGenerator()

    @Published private(set) var generating = false
    @Published private(set) var reading = false
    @Published private(set) var error: String?
    @Published private(set) var errorVideoID: String?
    private var transcripts: [String: String] = [:]

    func generate(
        for video: PosterVideo,
        platforms: [PublishPlatform],
        brief: String,
        titleOnly: Bool,
        into drafts: PosterDraftStore,
        reference: String? = nil
    ) async {
        guard !platforms.isEmpty, !generating else { return }
        generating = true
        error = nil
        errorVideoID = video.id
        defer { generating = false }
        do {
            let description = drafts.description(video).trimmingCharacters(in: .whitespacesAndNewlines)
            let reference = reference?.trimmingCharacters(in: .whitespacesAndNewlines)
            let hasContext = !description.isEmpty || !(reference ?? "").isEmpty || !(video.sourceCaption ?? "").isEmpty
            var transcript: String?
            if !hasContext {
                if case let .project(listing) = video.origin,
                   let project = try await ProjectPackageStore(package: listing.package).load() {
                    transcript = TimelineInspectionService.timelineWords(project: project).map(\.text).joined(separator: " ")
                } else if video.noSpeech {
                    transcript = ""
                } else if let id = video.contentItemID {
                    let content: PosterContentEnvelope = try await PosterHTTP.get("api/content/\(id)")
                    if content.item.transcriptStatus == "ready" {
                        transcript = content.item.recordedTranscript ?? ""
                    } else if let submission = video.submissionID {
                        transcript = try await hear("submission:\(submission)", body: ["submissionId": submission])
                        let _: PosterContentEnvelope = try await PosterHTTP.patch("api/content/\(id)", body: [
                            "recordedTranscript": transcript ?? "", "transcriptStatus": "ready",
                        ])
                    }
                } else if let key = video.mediaKey {
                    transcript = try await hear(key, body: ["mediaKey": key])
                }
                guard !(transcript ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
                    throw PosterMessage("No speech was detected. Describe the video above, or write one caption and use it for the others.")
                }
            }
            let response: PosterCaptionResponse = try await PosterHTTP.post("api/publish/caption", body: .compact([
                "title": video.title,
                "platforms": platforms.map(\.rawValue),
                "contentItemId": video.contentItemID,
                "matchStyle": true,
                "transcript": transcript,
                "sourceCaption": video.sourceCaption,
                "requireTranscript": !hasContext,
                "videoDescription": description,
                "captionReference": reference,
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
    private func hear(_ key: String, body: [String: Any]) async throws -> String {
        if let cached = transcripts[key] { return cached }
        reading = true
        defer { reading = false }
        guard let result: PosterTranscript = try? await PosterHTTP.post("api/transcribe", body: body)
        else {
            throw PosterMessage("The video could not be transcribed. Describe the video above, or write a caption yourself.")
        }
        transcripts[key] = result.text
        return result.text
    }
}
