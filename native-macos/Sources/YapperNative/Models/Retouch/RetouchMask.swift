import CoreGraphics
import CoreImage
import Foundation

/// The shapes the retouch effects are allowed to touch.
///
/// Both effects are only ever right inside a small part of the frame, and both
/// look terrible outside it: smoothing applied to the whole picture wipes the
/// texture off a jumper and a wall, and brightening everything yellow lifts
/// wood, skin and lamplight along with a tooth. So each one is handed a mask
/// and does nothing beyond it.
enum RetouchMask {
    /// A soft ellipse over the face, in the frame's own pixels.
    ///
    /// Wider and taller than Vision's box, which is drawn tight around the
    /// features and stops below the hairline: smoothing that ended at the box
    /// would leave a visible seam across the forehead. The edge is a long
    /// gradient rather than a line for the same reason.
    static func face(_ bounds: CGRect, in extent: CGRect) -> CIImage? {
        guard bounds.width > 1, bounds.height > 1 else { return nil }
        let radius = max(bounds.width, bounds.height) / 2
        let gradient = CIFilter(name: "CIRadialGradient")
        gradient?.setValue(CIVector(x: 0, y: 0), forKey: kCIInputCenterKey)
        // Solid across the middle two thirds, fading out over the rest.
        gradient?.setValue(radius * 0.62, forKey: "inputRadius0")
        gradient?.setValue(radius, forKey: "inputRadius1")
        gradient?.setValue(CIColor.white, forKey: "inputColor0")
        gradient?.setValue(CIColor(red: 0, green: 0, blue: 0, alpha: 1), forKey: "inputColor1")
        guard let circle = gradient?.outputImage else { return nil }

        // Drawn as a circle at the origin and then stretched, which is the only
        // way to get an ellipse out of a radial gradient.
        let grown = bounds.insetBy(dx: -bounds.width * 0.12, dy: -bounds.height * 0.18)
        return circle
            .transformed(
                by: CGAffineTransform(
                    scaleX: grown.width / (radius * 2),
                    y: grown.height / (radius * 2)
                )
                .concatenating(
                    CGAffineTransform(translationX: grown.midX, y: grown.midY)
                )
            )
            .cropped(to: extent)
    }

    /// A mask over the mouth opening, in the frame's own pixels.
    ///
    /// Rasterised rather than composed out of filters, because the mouth is an
    /// arbitrary polygon and Core Image has no way to draw one. Only the
    /// mouth's own corner of the frame is drawn, so the cost does not follow
    /// the frame size: a mask that stops short of the frame simply has no
    /// effect out there, which is exactly what is wanted.
    static func mouth(_ points: [CGPoint], in extent: CGRect) -> CIImage? {
        guard points.count >= 3 else { return nil }
        var box = CGRect(
            x: points.map(\.x).min() ?? 0,
            y: points.map(\.y).min() ?? 0,
            width: 0,
            height: 0
        )
        box.size = CGSize(
            width: (points.map(\.x).max() ?? 0) - box.minX,
            height: (points.map(\.y).max() ?? 0) - box.minY
        )
        guard box.width > 2, box.height > 1 else { return nil }

        // Room for the blur to fall off inside the drawn image, so the mask
        // fades rather than ending on a hard rectangle edge.
        let feather = max(2, min(box.width, box.height) * 0.25)
        let canvas = box.insetBy(dx: -feather * 2, dy: -feather * 2).integral
        guard
            canvas.width >= 1, canvas.height >= 1,
            let context = CGContext(
                data: nil,
                width: Int(canvas.width),
                height: Int(canvas.height),
                bitsPerComponent: 8,
                bytesPerRow: 0,
                space: CGColorSpaceCreateDeviceGray(),
                bitmapInfo: CGImageAlphaInfo.none.rawValue
            )
        else { return nil }

        context.setFillColor(CGColor(gray: 0, alpha: 1))
        context.fill(CGRect(origin: .zero, size: canvas.size))
        context.setFillColor(CGColor(gray: 1, alpha: 1))
        context.beginPath()
        context.move(
            to: CGPoint(x: points[0].x - canvas.minX, y: points[0].y - canvas.minY)
        )
        for point in points.dropFirst() {
            context.addLine(to: CGPoint(x: point.x - canvas.minX, y: point.y - canvas.minY))
        }
        context.closePath()
        context.fillPath()
        guard let drawn = context.makeImage() else { return nil }

        return CIImage(cgImage: drawn)
            .transformed(by: CGAffineTransform(translationX: canvas.minX, y: canvas.minY))
            .applyingFilter("CIGaussianBlur", parameters: [kCIInputRadiusKey: feather / 2])
            .cropped(to: extent)
    }
}
