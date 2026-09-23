import CoreGraphics
import Foundation

/// Stills for library cards. The library stores no thumbnails, so each is a
/// frame pulled from the signed master, a few at a time, cached for the
/// session. Nothing here blocks the page: cards show a placeholder until
/// their still arrives.
actor PosterThumbnailCache {
    static let shared = PosterThumbnailCache()

    private var images: [PosterMediaRef: CGImage] = [:]
    private var failed: Set<PosterMediaRef> = []
    private var running = 0
    private var waiting: [CheckedContinuation<Void, Never>] = []

    func cached(_ media: PosterMediaRef) -> CGImage? { images[media] }

    func image(for media: PosterMediaRef) async -> CGImage? {
        if let hit = images[media] { return hit }
        if failed.contains(media) { return nil }
        await acquire()
        defer { release() }
        if let hit = images[media] { return hit }
        do {
            let url = try await PosterMediaResolver.shared.url(for: media)
            let image = try await PosterFrameSource.poster(for: url)
            images[media] = image
            return image
        } catch {
            failed.insert(media)
            return nil
        }
    }

    private func acquire() async {
        if running < 3 {
            running += 1
            return
        }
        await withCheckedContinuation { waiting.append($0) }
    }

    private func release() {
        if waiting.isEmpty {
            running -= 1
        } else {
            waiting.removeFirst().resume()
        }
    }
}
