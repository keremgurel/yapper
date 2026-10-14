import AppKit
import SwiftUI

/// A remote cover or avatar that survives the page around it redrawing.
///
/// SwiftUI's `AsyncImage` cancels its download whenever its view is rebuilt
/// mid-flight and then stays on the failure phase for good. Pages that
/// refresh while they load (Home, Poster) were left with most channel covers
/// blank. Downloads here belong to a shared cache, so a rebuild picks up the
/// same download, and a finished cover paints at once on the next visit.
struct RemoteThumbnail<Placeholder: View>: View {
    let url: URL?
    @ViewBuilder var placeholder: () -> Placeholder
    @State private var image: NSImage?

    var body: some View {
        ZStack {
            if let image {
                Image(nsImage: image).resizable().scaledToFill()
            } else {
                placeholder()
            }
        }
        .task(id: url) {
            guard let url else { image = nil; return }
            image = RemoteThumbnailCache.shared.cached(url)
            if image == nil { image = await RemoteThumbnailCache.shared.image(for: url) }
        }
    }
}

extension RemoteThumbnail where Placeholder == Color {
    init(url: URL?) {
        self.init(url: url) { Color.clear }
    }
}

/// Decoded covers by URL, with one download per URL however many views ask.
@MainActor
final class RemoteThumbnailCache {
    static let shared = RemoteThumbnailCache()

    private let images = NSCache<NSURL, NSImage>()
    private var loading: [URL: Task<NSImage?, Never>] = [:]

    private init() {
        images.countLimit = 400
    }

    func cached(_ url: URL) -> NSImage? {
        images.object(forKey: url as NSURL)
    }

    func image(for url: URL) async -> NSImage? {
        if let hit = cached(url) { return hit }
        let task = loading[url] ?? Task.detached(priority: .utility) { await Self.download(url) }
        loading[url] = task
        let image = await task.value
        loading[url] = nil
        if let image { images.setObject(image, forKey: url as NSURL) }
        return image
    }

    /// Two tries: a CDN that drops one request under a burst usually serves
    /// the next.
    private nonisolated static func download(_ url: URL) async -> NSImage? {
        for attempt in 0..<2 {
            if attempt > 0 { try? await Task.sleep(for: .milliseconds(600)) }
            do {
                let (data, response) = try await URLSession.shared.data(from: url)
                let status = (response as? HTTPURLResponse)?.statusCode ?? 0
                if (200..<300).contains(status), let image = NSImage(data: data) { return image }
                PerfLog.logger.debug("thumbnail \(status) \(data.count)B \(url.host() ?? "", privacy: .public)")
            } catch {
                PerfLog.logger.debug("thumbnail failed \(error.localizedDescription, privacy: .public) \(url.host() ?? "", privacy: .public)")
            }
        }
        return nil
    }
}
