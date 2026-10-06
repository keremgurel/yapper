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

    func open(_ video: PosterVideo) async {
        guard video.canOpen else { return }
        let request = UUID()
        generation = request
        error = nil
        active = video
        importingID = video.id
        defer { if generation == request { importingID = nil } }
        do {
            if case let .project(listing) = video.origin {
                let rendered = try await PosterProjectRender.shared.render(listing)
                guard generation == request else { return }
                active?.previewURL = rendered
                return
            }
            guard case let .platform(platform, sourceID, _, _, _, _, _, key, _) = video.origin else { return }
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
                    guard platform == .instagram else { throw error }
                }
            }
            guard platform == .instagram else { return }
            // Clear an obsolete key so it cannot be sent while being repaired.
            if generation == request {
                active = video.withImportedMedia(key: nil, title: video.title)
            }
            let task: Task<PosterImportedMedia, Error>
            if let existing = imports[video.id] { task = existing }
            else {
                task = Task { try await PosterHTTP.post("api/publish/instagram/import", body: ["mediaId": sourceID]) }
                imports[video.id] = task
            }
            defer { imports[video.id] = nil }
            let imported = try await task.value
            guard generation == request else { return }
            active = video.withImportedMedia(key: imported.mediaKey, title: imported.title)
        } catch {
            guard generation == request else { return }
            if case .project = video.origin { self.error = error.localizedDescription }
            else { self.error = PosterErrorCopy.importFailure((error as? PosterHTTPError)?.code) }
        }
    }

    func close() {
        generation = UUID()
        active = nil
        importingID = nil
        error = nil
    }
}
