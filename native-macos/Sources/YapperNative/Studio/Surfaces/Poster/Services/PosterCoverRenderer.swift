import AppKit
import CoreGraphics

/// Draws the cover exactly as it ships: the chosen image cropped to fill a
/// 1080 by 1920 frame, with the optional headline burned in. The same
/// drawing backs the on-screen preview, the download and the upload.
enum PosterCoverRenderer {
    static let size = CGSize(width: 1080, height: 1920)

    static func render(_ draft: PosterCoverDraft) -> CGImage? {
        guard let image = draft.image,
              let context = CGContext(
                data: nil, width: Int(size.width), height: Int(size.height), bitsPerComponent: 8, bytesPerRow: 0,
                space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
              )
        else { return nil }
        context.interpolationQuality = .high
        context.draw(image, in: fillRect(for: image))
        if draft.hasHeadline { paintHeadline(draft, in: context) }
        return context.makeImage()
    }

    static func png(_ draft: PosterCoverDraft) -> Data? {
        guard let image = render(draft) else { return nil }
        return NSBitmapImageRep(cgImage: image).representation(using: .png, properties: [:])
    }

    private static func fillRect(for image: CGImage) -> CGRect {
        let scale = max(size.width / CGFloat(image.width), size.height / CGFloat(image.height))
        let width = CGFloat(image.width) * scale
        let height = CGFloat(image.height) * scale
        return CGRect(x: (size.width - width) / 2, y: (size.height - height) / 2, width: width, height: height)
    }

    private static func paintHeadline(_ draft: PosterCoverDraft, in context: CGContext) {
        let headline = draft.headline.trimmingCharacters(in: .whitespacesAndNewlines)
        var fontSize: CGFloat = 92
        var lines = wrap(headline, font: font(fontSize))
        while lines.count > 4 && fontSize > 50 {
            fontSize -= 6
            lines = wrap(headline, font: font(fontSize))
        }
        let lineHeight = fontSize * 1.05
        // Positions are measured from the top, as on the web canvas.
        let centerFromTop: CGFloat = switch draft.position {
        case .top: 330
        case .center: 920
        case .bottom: 1530
        }
        let firstFromTop = centerFromTop - CGFloat(lines.count - 1) * lineHeight / 2

        if draft.position == .bottom {
            let colors = [CGColor(gray: 0, alpha: 0), CGColor(gray: 0, alpha: 0.78)] as CFArray
            if let gradient = CGGradient(colorsSpace: CGColorSpaceCreateDeviceGray(), colors: colors, locations: [0, 1]) {
                context.saveGState()
                context.clip(to: CGRect(x: 0, y: 0, width: size.width, height: size.height - 980))
                context.drawLinearGradient(gradient, start: CGPoint(x: 0, y: size.height - 1050), end: .zero, options: [])
                context.restoreGState()
            }
        }

        let textFont = font(fontSize)
        if draft.textStyle == .label {
            let widest = lines.map { measure($0, font: textFont).width }.max() ?? 0
            let boxWidth = min(970, widest + 110)
            let boxHeight = lineHeight * CGFloat(lines.count) + 84
            let box = CGRect(x: (size.width - boxWidth) / 2, y: size.height - centerFromTop - boxHeight / 2,
                             width: boxWidth, height: boxHeight)
            context.setFillColor(CGColor(red: 0.96, green: 0.85, blue: 0.04, alpha: 1))
            context.addPath(CGPath(roundedRect: box, cornerWidth: 28, cornerHeight: 28, transform: nil))
            context.fillPath()
        }

        NSGraphicsContext.saveGraphicsState()
        NSGraphicsContext.current = NSGraphicsContext(cgContext: context, flipped: false)
        for (index, line) in lines.enumerated() {
            let centerY = size.height - (firstFromTop + CGFloat(index) * lineHeight)
            let fill = NSColor(white: draft.textStyle == .label ? 0.03 : 1, alpha: 1)
            if draft.textStyle == .shadow {
                let strokePercent = max(12, fontSize * 0.14) / fontSize * 100
                draw(line, font: textFont, centerY: centerY, attributes: [
                    .strokeColor: NSColor(white: 0, alpha: 0.92), .strokeWidth: strokePercent,
                ])
            }
            draw(line, font: textFont, centerY: centerY, attributes: [.foregroundColor: fill])
        }
        NSGraphicsContext.restoreGraphicsState()
    }

    /// Cover artwork, not interface text: heavy so it reads at phone size,
    /// matching what the web renders.
    private static func font(_ size: CGFloat) -> NSFont { .systemFont(ofSize: size, weight: .heavy) }

    private static func measure(_ text: String, font: NSFont) -> CGSize {
        NSAttributedString(string: text, attributes: [.font: font]).size()
    }

    private static func draw(_ text: String, font: NSFont, centerY: CGFloat, attributes: [NSAttributedString.Key: Any]) {
        var all = attributes
        all[.font] = font
        let string = NSAttributedString(string: text, attributes: all)
        let measured = string.size()
        string.draw(at: CGPoint(x: (size.width - measured.width) / 2, y: centerY - measured.height / 2))
    }

    private static func wrap(_ text: String, font: NSFont) -> [String] {
        var lines: [String] = []
        var line = ""
        for word in text.split(whereSeparator: \.isWhitespace).map(String.init) {
            let candidate = line.isEmpty ? word : "\(line) \(word)"
            if !line.isEmpty && measure(candidate, font: font).width > 850 {
                lines.append(line)
                line = word
            } else {
                line = candidate
            }
        }
        if !line.isEmpty { lines.append(line) }
        return lines
    }
}
