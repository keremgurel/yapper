import AppKit
import UniformTypeIdentifiers

/// Adding finished videos from disk, by picker or by drop: presign, upload
/// with progress, register, create the library row, then hear the video so
/// captions are written from what it says. The same path attaches a channel
/// post's original, which stays on the bench as that post.
@MainActor
final class PosterUploadStore: ObservableObject {
    enum Phase: Equatable { case idle, uploading, preparing, failed }

    static let shared = PosterUploadStore()

    @Published private(set) var phase: Phase = .idle
    @Published private(set) var progress: Double = 0
    @Published private(set) var errorCode: String?
    @Published private(set) var transcriptFailed = false
    /// The video holding the one waiting slot, when an upload was refused
    /// because of it, and the file that was refused, to add once it is gone.
    @Published private(set) var waiting: PosterWaitingVideo?
    /// The channel post the current or last failed upload is attaching to.
    @Published private(set) var attachingID: String?
    private var refused: (file: URL, original: PosterVideo?)?
    @Published private(set) var discarding = false

    var busy: Bool { phase == .uploading || phase == .preparing }

    /// Called with each new row as soon as it exists, then again once its
    /// transcript status settles.
    var onSelected: (PosterVideo) -> Void = { _ in }
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

    /// Picks the original for a channel post Yapper has no file for. Its title
    /// and caption go with the upload, which also appears in Uploads.
    func attach(to original: PosterVideo) {
        guard !busy else { return }
        let panel = NSOpenPanel()
        panel.title = "Attach the original video"
        panel.allowedContentTypes = [.movie]
        panel.allowsMultipleSelection = false
        guard panel.runModal() == .OK, let url = panel.url else { return }
        Task { await upload(url, attachingTo: original) }
    }

    /// Sequential, because each upload streams a whole video.
    func add(_ urls: [URL]) {
        guard !urls.isEmpty, !busy else { return }
        Task {
            for url in urls { await upload(url) }
        }
    }

    private func upload(_ file: URL, attachingTo original: PosterVideo? = nil) async {
        attachingID = original?.id
        guard let mimeType = Self.videoType(for: file) else {
            errorCode = "not_video"
            phase = .failed
            return
        }
        let localVideo = PosterVideo(file: file)
        if original == nil { onSelected(localVideo) }
        phase = .uploading
        progress = 0
        errorCode = nil
        transcriptFailed = false
        do {
            let bytes = (try? file.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0
            guard bytes > 0 else { throw PosterUploadFailure("not_video") }
            let title = original?.title ?? file.deletingPathExtension().lastPathComponent
            let ext = String(mimeType.split(separator: "/").last ?? "mp4")
            let ticket = try await PosterFileUpload.ticket(bytes: bytes, mimeType: mimeType, ext: ext, purpose: .recording)
            guard let target = URL(string: ticket.url) else { throw PosterUploadFailure("failed") }
            try await PosterFileUpload.put(file: file, to: target, mimeType: mimeType) { value in
                Task { @MainActor in self.progress = value }
            }
            let submission = try await register(key: ticket.key, title: title)
            let created: PosterContentEnvelope = try await PosterHTTP.post("api/content", body: .compact([
                "title": title.isEmpty ? "Untitled video" : title,
                "submissionId": submission,
                "sourceUrl": "yapper://poster-upload",
                "sourceTitle": "Poster upload",
                "transcriptStatus": "pending",
                "originalNote": original?.sourceCaption,
            ]))
            if let original {
                PosterBench.shared.attach(original.withAttachedOriginal(file: file, submissionID: submission, contentItemID: created.item.id))
                attachingID = nil
            } else if PosterBench.shared.active?.id == localVideo.id {
                var prepared = localVideo
                prepared.preparedSubmissionID = submission
                prepared.preparedContentItemID = created.item.id
                prepared.preparedTranscriptStatus = "pending"
                PosterBench.shared.active = prepared
            }
            onAdded(created.item)
            phase = .idle
            Task { await transcribe(item: created.item, submission: submission) }
        } catch let failure as PosterUploadFailure {
            if failure.code == "slot_busy", let waiting = failure.waiting {
                self.waiting = waiting
                refused = (file, original)
                phase = .idle
                return
            }
            errorCode = failure.code
            phase = .failed
        } catch {
            errorCode = "failed"
            phase = .failed
        }
    }

    /// Discards the waiting upload so the refused one can go in its place.
    func discardWaitingAndAdd() async {
        guard let waiting, waiting.kind == "upload", !discarding else { return }
        discarding = true
        defer { discarding = false }
        do {
            try await StudioJSONClient.delete("api/submissions/\(waiting.id)")
            self.waiting = nil
            onDiscarded()
            if let refused {
                self.refused = nil
                await upload(refused.file, attachingTo: refused.original)
            }
        } catch {
            errorCode = "failed"
            phase = .failed
        }
    }

    /// Keeps the waiting video and drops the refused file.
    func keepWaiting() {
        waiting = nil
        refused = nil
    }

    /// Set by the page: refresh the library after a discard.
    var onDiscarded: () -> Void = {}

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
