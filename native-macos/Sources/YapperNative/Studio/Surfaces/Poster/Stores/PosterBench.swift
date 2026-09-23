import Foundation

/// Which video is open. Opening an Instagram post Yapper has no file for
/// imports it first, so the same click opens a Reel a few seconds later.
@MainActor
final class PosterBench: ObservableObject {
    static let shared = PosterBench()

    @Published var active: PosterVideo?
    @Published private(set) var importingID: String?
    @Published private(set) var error: String?

    func open(_ video: PosterVideo) async {
        error = nil
        guard video.canOpen else { return }
        guard case let .platform(_, sourceID, _, _, _, _, _, mediaKey, _) = video.origin, mediaKey == nil else {
            active = video
            return
        }
        importingID = video.id
        defer { importingID = nil }
        do {
            let imported: PosterImportedMedia = try await PosterHTTP.post(
                "api/publish/instagram/import", body: ["mediaId": sourceID]
            )
            active = video.withImportedMedia(key: imported.mediaKey, title: imported.title)
        } catch let failure as PosterHTTPError {
            error = PosterErrorCopy.importFailure(failure.code)
        } catch {
            self.error = PosterErrorCopy.importFailure(nil)
        }
    }

    func close() { active = nil }
}
