import CoreGraphics
import Foundation

/// The frame under the playhead, for the open video. Rapid scrubbing is
/// coalesced: only the latest wanted frame is decoded once the current
/// decode finishes, so two decodes never race to set the cover.
@MainActor
final class PosterFramePicker: ObservableObject {
    @Published private(set) var source: PosterFrameSource?
    @Published private(set) var loading = true
    @Published private(set) var index = 0
    @Published private(set) var busy = false
    @Published private(set) var error: String?
    @Published private(set) var tiles: [CGImage?] = []
    @Published private(set) var videoURL: URL?

    /// Receives each decoded frame and its time.
    var onFrame: (CGImage, Double) -> Void = { _, _ in }
    private var wanted = 0
    private var media: PosterMediaRef?
    private var initialTime: Double = 1
    private var cache: [Int: CGImage] = [:]

    var frameCount: Int { source?.frameCount ?? 0 }
    var duration: Double { source?.duration ?? 0 }
    var time: Double { source?.time(ofFrame: index) ?? 0 }
    var ready: Bool { source != nil }

    func load(_ media: PosterMediaRef, initialTime: Double) async {
        self.media = media
        self.initialTime = initialTime
        loading = true
        error = nil
        do {
            let url = try await PosterMediaResolver.shared.url(for: media)
            videoURL = url
            let source = try await PosterFrameSource.open(url)
            guard self.media == media else { return }
            self.source = source
            loading = false
            select(source.frameIndex(at: initialTime))
            let strip = await source.filmstrip(count: 12)
            if self.media == media { tiles = strip }
        } catch {
            loading = false
            self.error = "The video preview could not be loaded."
        }
    }

    func retry() {
        if let media, source == nil {
            Task { await load(media, initialTime: initialTime) }
        } else {
            cache.removeAll()
            select(index)
        }
    }

    func select(_ next: Int) {
        guard let source else { return }
        index = max(0, min(source.frameCount - 1, next))
        wanted = index
        if !busy { Task { await decode() } }
    }

    func seek(to seconds: Double) {
        guard let source else { return }
        select(source.frameIndex(at: seconds))
    }

    func step(_ frames: Int) { select(index + frames) }

    func jump(_ seconds: Double) {
        guard let source else { return }
        select(index + Int((seconds * source.fps).rounded()))
    }

    private func decode() async {
        guard let source else { return }
        busy = true
        error = nil
        defer { busy = false }
        while true {
            let target = wanted
            if let cached = cache[target] {
                onFrame(cached, source.time(ofFrame: target))
                if target == wanted { return } else { continue }
            }
            do {
                let image = try await source.frame(at: target)
                cache[target] = image
                if target == wanted {
                    onFrame(image, source.time(ofFrame: target))
                    return
                }
            } catch {
                self.error = "That frame could not be read. Try again."
                return
            }
        }
    }
}
