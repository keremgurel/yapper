import AppKit
import CoreGraphics
import UniformTypeIdentifiers

/// Moving images between files, the pasteboard, and the data URLs the
/// thumbnail route reads and writes.
enum PosterImageData {
    static func jpegDataURL(_ image: CGImage, quality: Double = 0.9) -> String? {
        let rep = NSBitmapImageRep(cgImage: image)
        guard let data = rep.representation(using: .jpeg, properties: [.compressionFactor: quality]) else { return nil }
        return "data:image/jpeg;base64,\(data.base64EncodedString())"
    }

    static func image(fromDataURL string: String) -> CGImage? {
        guard let comma = string.firstIndex(of: ","), string.hasPrefix("data:image/"),
              let data = Data(base64Encoded: String(string[string.index(after: comma)...]))
        else { return nil }
        return image(from: data)
    }

    static func image(from data: Data) -> CGImage? {
        guard let source = CGImageSourceCreateWithData(data as CFData, nil) else { return nil }
        return CGImageSourceCreateImageAtIndex(source, 0, nil)
    }

    /// A JPG, PNG or WebP under 20 MB, or a sentence saying what is wrong.
    static func coverImage(at url: URL) -> Result<CGImage, PosterMessage> {
        let type = UTType(filenameExtension: url.pathExtension.lowercased())
        guard let type, [UTType.jpeg, .png, .webP].contains(where: { type.conforms(to: $0) }) else {
            return .failure(PosterMessage("Choose a JPG, PNG, or WebP image."))
        }
        let size = (try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0
        guard size > 0, size <= 20 * 1024 * 1024 else { return .failure(PosterMessage("Choose an image under 20 MB.")) }
        guard let data = try? Data(contentsOf: url), let image = image(from: data) else {
            return .failure(PosterMessage("The image could not be opened. Try another file."))
        }
        return .success(image)
    }

    /// The first image on the pasteboard, if any.
    static func pastedImage() -> CGImage? {
        guard let image = NSImage(pasteboard: .general) else { return nil }
        return image.cgImage(forProposedRect: nil, context: nil, hints: nil)
    }

    /// Asks for one image file.
    @MainActor
    static func chooseImage(title: String) -> URL? {
        let panel = NSOpenPanel()
        panel.title = title
        panel.allowedContentTypes = [.jpeg, .png, .webP]
        panel.allowsMultipleSelection = false
        return panel.runModal() == .OK ? panel.url : nil
    }
}

/// A sentence for the creator, usable as an error.
struct PosterMessage: Error, Equatable {
    let text: String
    init(_ text: String) { self.text = text }
}
