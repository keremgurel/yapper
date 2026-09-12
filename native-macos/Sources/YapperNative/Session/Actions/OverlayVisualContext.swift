import AppKit
import Foundation

@MainActor
extension EditorSession {
    /// Aim on the original pixels, even when the current scene hides a value.
    func overlaySourceImage(_ media: ProjectMedia) -> CGImage? {
        let url = media.isScene
            ? media.url.deletingLastPathComponent().appending(path: "image-original.png") : media.url
        if media.isImage, let image = NSImage(contentsOf: url),
           let cg = image.cgImage(forProposedRect: nil, context: nil, hints: nil) { return cg }
        return thumbnailsByMedia[media.id]?.first
    }
}


@MainActor
extension EditorSession {
    func overlayVisualReference() -> ActionJSON {
        guard let id = selectedOverlayID,
              let overlay = overlays.first(where: { $0.id == id }),
              let media = media(for: overlay), let image = overlaySourceImage(media) else { return .null }
        let scale = min(1, 960 / Double(max(image.width, image.height)))
        let width = max(1, Int(Double(image.width) * scale)), height = max(1, Int(Double(image.height) * scale))
        guard let context = CGContext(data: nil, width: width, height: height,
            bitsPerComponent: 8, bytesPerRow: 0, space: CGColorSpace(name: CGColorSpace.sRGB)!,
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return .null }
        context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
        guard let resized = context.makeImage(),
              let jpeg = NSBitmapImageRep(cgImage: resized).representation(using: .jpeg,
                properties: [.compressionFactor: 0.6]), jpeg.count <= 150_000 else { return .null }
        return .object(["overlayID": .string(id.uuidString), "jpeg": .string(jpeg.base64EncodedString()),
            "description": .string("Original source image or thumbnail of the selected overlay. Normalized coordinates start at the top left.")])
    }
}
