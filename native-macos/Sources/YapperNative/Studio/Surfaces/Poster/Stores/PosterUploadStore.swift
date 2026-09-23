import AppKit
import UniformTypeIdentifiers

/// Adding finished videos from disk, by picker or by drop: presign, upload
/// with progress, register, create the library row, then hear the video so
/// captions are written from what it says.
@MainActor
final class PosterUploadStore: ObservableObject {
    enum Phase: Equatable { case idle, uploading, preparing, failed }

    static let shared = PosterUploadStore()

    @Published private(set) var phase: Phase = .idle
    @Published private(set) var progress: Double = 0
    @Published private(set) var errorCode: String?
    @Published private(set) var transcriptFailed = false

    var busy: Bool { phase == .uploading || phase == .preparing }

    /// Called with each new row as soon as it exists, then again once its
    /// transcript status settles.
    var onAdded: (PosterContentItem) -> Void = { _ in }
    var onUpdated: (PosterContentItem) -> Void = { _ in }

    func choose() {
        let panel = NSOpenPanel()
        panel.title = "Add a finished video"
        panel.allowedContentTypes = [.movie]
        panel.allowsMultipleSelection = true
        guard panel.runModal() == .OK else { return }
        add(panel.urls)
    }

    /// Sequential, because each upload streams a whole video.
    func add(_ urls: [URL]) {
        guard !urls.isEmpty, !busy else { return }
        Task {
            for url in urls { await upload(url) }
        }
    }

    private func upload(_ file: URL) async {
        guard let mimeType = Self.videoType(for: file) else {
            errorCode = "not_video"
            phase = .failed
            return
        }
        phase = .uploading
        progress = 0
        errorCode = nil
        transcriptFailed = false
        do {
            let bytes = (try? file.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0
            guard bytes > 0 else { throw PosterUploadFailure("not_video") }
            let title = file.deletingPathExtension().lastPathComponent
            let ext = String(mimeType.split(separator: "/").last ?? "mp4")
            let ticket = try await PosterFileUpload.ticket(bytes: bytes, mimeType: mimeType, ext: ext, purpose: .recording)
            guard let target = URL(string: ticket.url) else { throw PosterUploadFailure("failed") }
            try await PosterFileUpload.put(file: file, to: target, mimeType: mimeType) { value in
                Task { @MainActor in self.progress = value }
            }
            let submission = try await register(key: ticket.key, title: title)
            let created: PosterContentEnvelope = try await PosterHTTP.post("api/content", body: [
                "title": title.isEmpty ? "Untitled video" : title,
                "submissionId": submission,
                "sourceUrl": "yapper://poster-upload",
                "sourceTitle": "Poster upload",
                "transcriptStatus": "pending",
            ])
            onAdded(created.item)
            phase = .preparing
            await transcribe(item: created.item, submission: submission)
            phase = .idle
        } catch let failure as PosterUploadFailure {
            errorCode = failure.code
            phase = .failed
        } catch {
            errorCode = "failed"
            phase = .failed
        }
    }

    private func register(key: String, title: String) async throws -> String {
        do {
            let envelope: PosterSubmissionEnvelope = try await PosterHTTP.post(
                "api/submissions", body: ["mediaKey": key, "title": title]
            )
            return envelope.submission.id
        } catch let error as PosterHTTPError {
            throw PosterUploadFailure(error.code == "not_entitled" ? "locked" : error.code == "storage_full" ? "storage_full" : "failed")
        }
    }

    private func transcribe(item: PosterContentItem, submission: String) async {
        do {
            let transcript: PosterTranscript = try await PosterHTTP.post("api/transcribe", body: ["submissionId": submission])
            guard !transcript.text.isEmpty else { throw PosterUploadFailure("transcript_failed") }
            let updated: PosterContentEnvelope = try await PosterHTTP.patch(
                "api/content/\(item.id)", body: ["recordedTranscript": transcript.text, "transcriptStatus": "ready"]
            )
            onUpdated(updated.item)
        } catch {
            transcriptFailed = true
            if let updated: PosterContentEnvelope = try? await PosterHTTP.patch(
                "api/content/\(item.id)", body: ["transcriptStatus": "unavailable"]
            ) {
                onUpdated(updated.item)
            }
        }
    }

    static func videoType(for url: URL) -> String? {
        switch url.pathExtension.lowercased() {
        case "mp4": "video/mp4"
        case "mov": "video/quicktime"
        case "webm": "video/webm"
        case "m4v": "video/x-m4v"
        default:
            UTType(filenameExtension: url.pathExtension)?.conforms(to: .movie) == true
                ? UTType(filenameExtension: url.pathExtension)?.preferredMIMEType : nil
        }
    }
}
