import Foundation

/// Selection is immediate. Rendering/importing happens while captions are edited.
@MainActor
final class PosterBench: ObservableObject {
    static let shared = PosterBench()
    @Published var active: PosterVideo?
    @Published private(set) var importingID: String?
    @Published private(set) var error: String?
    private var generation = UUID()
    private var imports: [String: Task<PosterImportedMedia, Error>] = [:]
    /// Channel posts the creator attached an original to, by post id, so
    /// reopening one in this session reuses the upload.
    private var attached: [String: PosterVideo] = [:]

    func open(_ video: PosterVideo) async {
        guard video.canOpen else { return }
        let request = UUID()
        generation = request
        error = nil
        if let attached = attached[video.id] {
            active = attached
            importingID = nil
            return
        }
        active = video
        // A YouTube post waits on the attach step; nothing to fetch yet.
        if video.needsOriginal {
            importingID = nil
            return
        }
        importingID = video.id
        defer { if generation == request { importingID = nil } }
        do {
            if case let .project(listing) = video.origin {
                let rendered = try await PosterProjectRender.shared.render(listing)
                guard generation == request else { return }
                PosterDraftStore.shared.useRevision(rendered.deletingPathExtension().lastPathComponent, for: video)
                active?.previewURL = rendered
                return
            }
            guard case let .platform(platform, sourceID, _, _, _, _, _, key, importable) = video.origin else { return }
            if key != nil {
                if generation == request { active = video.withImportedMedia(key: nil, title: video.title) }
                do {
                    let signed = try await PosterMediaResolver.shared.url(for: PosterMediaRef(mediaKey: key))
                    if generation == request {
                        var ready = video
                        ready.previewURL = signed
                        active = ready
                    }
                    return
                } catch {
                    guard importable else { throw error }
                }
            }
            guard importable else { return }
            // Clear an obsolete key so it cannot be sent while being repaired.
            if generation == request {
                active = video.withImportedMedia(key: nil, title: video.title)
            }
            let task: Task<PosterImportedMedia, Error>
            if let existing = imports[video.id] { task = existing }
            else {
                task = Task { try await PosterHTTP.post("api/publish/\(platform.rawValue)/import", body: ["mediaId": sourceID]) }
                imports[video.id] = task
            }
            defer { imports[video.id] = nil }
            let imported = try await task.value
            guard generation == request else { return }
            active = video.withImportedMedia(key: imported.mediaKey, title: imported.title)
        } catch {
            guard generation == request else { return }
            if case .project = video.origin { self.error = error.localizedDescription }
            else { self.error = PosterErrorCopy.importFailure((error as? PosterHTTPError)?.code, platform: video.platform ?? .instagram) }
        }
    }

    /// Takes a finished attach. A late upload never reopens a closed post or
    /// replaces a different selection; it is kept for when the post reopens.
    func attach(_ video: PosterVideo) {
        attached[video.id] = video
        if active?.id == video.id { active = video }
    }

    /// A library row's transcript settled: the open video and any attached
    /// post behind it read it from now on.
    func apply(_ item: PosterContentItem) {
        func updated(_ video: PosterVideo) -> PosterVideo {
            var video = video
            video.preparedTranscriptStatus = item.transcriptStatus
            video.noSpeech = item.transcriptStatus == "ready" && item.recordedTranscript == ""
            return video
        }
        for (id, video) in attached where video.contentItemID == item.id { attached[id] = updated(video) }
        if let active, active.contentItemID == item.id { self.active = updated(active) }
    }

    func close() {
        generation = UUID()
        active = nil
        importingID = nil
        error = nil
    }
}
