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
    private var generation = UUID()
    private var wanted = 0
    private var media: PosterMediaRef?
    private var initialTime: Double = 1
    private var cache: [Int: CGImage] = [:]

    var frameCount: Int { source?.frameCount ?? 0 }
    var duration: Double { source?.duration ?? 0 }
    var time: Double { source?.time(ofFrame: index) ?? 0 }
    var ready: Bool { source != nil }

    func load(_ media: PosterMediaRef, initialTime: Double) async {
        let request = UUID()
        generation = request
        source = nil
        busy = false
        videoURL = nil
        tiles = []
        cache.removeAll()
        let started = ContinuousClock.now
        self.media = media
        self.initialTime = initialTime
        loading = true
        error = nil
        guard media.previewURL != nil || media.submissionID != nil || media.mediaKey != nil else { return }
        do {
            let url = try await PosterMediaResolver.shared.url(for: media)
            guard generation == request, !Task.isCancelled else { return }
            videoURL = url
            let source = try await PosterFrameSource.open(url)
            guard generation == request, !Task.isCancelled else { return }
            PerfLog.logger.info("poster.preview.ready \(PerfLog.milliseconds(since: started))ms")
            self.source = source
            loading = false
            select(source.frameIndex(at: initialTime))
            let strip = await source.filmstrip(count: 12)
            if generation == request, !Task.isCancelled { tiles = strip }
        } catch {
            guard generation == request, !Task.isCancelled else { return }
            loading = false
            PerfLog.logger.error("poster.preview.failed \(PerfLog.milliseconds(since: started))ms \(error.localizedDescription, privacy: .public)")
            self.error = "The video preview could not be loaded. You can still post with the current thumbnail."
        }
    }

    func fail(_ message: String) {
        generation = UUID()
        loading = false
        busy = false
        error = message
    }

    func retry() {
        if let media, source == nil {
            Task {
                var fresh = media
                if fresh.previewURL?.isFileURL != true, fresh.mediaKey != nil || fresh.submissionID != nil { fresh.previewURL = nil }
                await PosterMediaResolver.shared.invalidate(fresh)
                await load(fresh, initialTime: initialTime)
            }
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
        let request = generation
        busy = true
        error = nil
        defer { if generation == request { busy = false } }
        while true {
            let target = wanted
            if let cached = cache[target] {
                onFrame(cached, source.time(ofFrame: target))
                if target == wanted { return } else { continue }
            }
            do {
                let image = try await source.frame(at: target)
                guard generation == request, !Task.isCancelled else { return }
                if cache.count >= 12 { cache.removeAll(keepingCapacity: true) }
                cache[target] = image
                if target == wanted {
                    onFrame(image, source.time(ofFrame: target))
                    return
                }
            } catch {
                guard generation == request else { return }
                self.error = "That frame could not be read. Try again."
                return
            }
        }
    }
}
