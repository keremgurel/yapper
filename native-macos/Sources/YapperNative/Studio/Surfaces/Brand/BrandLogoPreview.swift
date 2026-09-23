import AppKit
import SwiftUI

/// A logo on a checkerboard, so transparent edges and white wordmarks show.
/// The image is read through NSImage (which also opens SVG) and kept in
/// memory by logo id, since presigned URLs change on every read.
struct BrandLogoPreview: View {
    let logo: BrandLogo
    @State private var image: NSImage?
    @State private var failed = false

    var body: some View {
        ZStack {
            BrandCheckerboard()
            if let image {
                Image(nsImage: image)
                    .resizable()
                    .scaledToFit()
                    .padding(28)
            } else if failed {
                Image(systemName: "photo").font(.system(size: 20)).foregroundStyle(.secondary)
            } else {
                ProgressView().controlSize(.small)
            }
        }
        .frame(height: 160)
        .clipped()
        .task(id: logo.id) { await load() }
    }

    private func load() async {
        if let cached = BrandLogoImageCache.shared.image(for: logo.id) {
            image = cached
            return
        }
        guard let url = URL(string: logo.url),
              let (data, _) = try? await URLSession.shared.data(from: url),
              let loaded = NSImage(data: data)
        else {
            failed = true
            return
        }
        BrandLogoImageCache.shared.store(loaded, for: logo.id)
        image = loaded
    }
}

@MainActor
private final class BrandLogoImageCache {
    static let shared = BrandLogoImageCache()
    private var images: [String: NSImage] = [:]
    func image(for id: String) -> NSImage? { images[id] }
    func store(_ image: NSImage, for id: String) { images[id] = image }
}

/// 9pt squares in two quiet tones.
struct BrandCheckerboard: View {
    var square: CGFloat = 9

    var body: some View {
        Canvas { context, size in
            context.fill(Path(CGRect(origin: .zero, size: size)), with: .color(Color.studioInputBackground))
            let columns = Int(ceil(size.width / square))
            let rows = Int(ceil(size.height / square))
            var path = Path()
            for row in 0..<rows {
                for column in 0..<columns where (row + column).isMultiple(of: 2) {
                    path.addRect(CGRect(x: CGFloat(column) * square, y: CGFloat(row) * square, width: square, height: square))
                }
            }
            context.fill(path, with: .color(Color.studioLine))
        }
    }
}
