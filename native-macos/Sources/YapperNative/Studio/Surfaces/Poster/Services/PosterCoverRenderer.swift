import AppKit
import CoreGraphics
import QuartzCore

/// Draws the cover exactly as it ships: the chosen image cropped to fill a
/// 1080 by 1920 frame, with the optional headline burned in. The same
/// drawing backs the on-screen preview, the download and the upload.
enum PosterCoverRenderer {
    static let size = CGSize(width: 1080, height: 1920)

    static func render(_ draft: PosterCoverDraft, size: CGSize = PosterCoverRenderer.size) -> CGImage? {
        guard let image = draft.image,
              let context = CGContext(
                data: nil, width: Int(size.width), height: Int(size.height), bitsPerComponent: 8, bytesPerRow: 0,
                space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
              )
        else { return nil }
        context.interpolationQuality = .high
        context.draw(image, in: fillRect(for: image, size: size))
        if draft.hasHeadline {
            let style = draft.textStyle
            let stage = CALayer()
            stage.frame = CGRect(origin: .zero, size: size)
            stage.addSublayer(TextAppearanceLayer.make(
                text: draft.headline, appearance: style.appearance, renderSize: size,
                centerX: style.x, centerY: style.y, maximumWidth: style.width, maximumHeight: 0.46,
                rotation: style.rotation
            ))
            stage.render(in: context)
        }
        return context.makeImage()
    }

    static func png(_ draft: PosterCoverDraft) -> Data? {
        guard let image = render(draft) else { return nil }
        return NSBitmapImageRep(cgImage: image).representation(using: .png, properties: [:])
    }

    static func jpeg(_ draft: PosterCoverDraft) -> Data? {
        guard let image = render(draft) else { return nil }
        return NSBitmapImageRep(cgImage: image).representation(using: .jpeg, properties: [.compressionFactor: 0.9])
    }

    private static func fillRect(for image: CGImage, size: CGSize) -> CGRect {
        let scale = max(size.width / CGFloat(image.width), size.height / CGFloat(image.height))
        let width = CGFloat(image.width) * scale
        let height = CGFloat(image.height) * scale
        return CGRect(x: (size.width - width) / 2, y: (size.height - height) / 2, width: width, height: height)
    }

}
