import CoreImage
import Foundation

/// A colour transform: three rows of weights over red, green and blue, plus a
/// constant added to each.
///
/// Every filter the editor offers is one of these, because every CSS filter
/// function the web studio uses is defined as one. Building the same matrices
/// here is what makes a filtered export match what the browser showed.
struct ColorMatrix: Equatable, Sendable {
    /// Three weights over red, green and blue.
    struct Row: Equatable, Sendable {
        var r: Double
        var g: Double
        var b: Double

        init(_ r: Double, _ g: Double, _ b: Double) {
            self.r = r
            self.g = g
            self.b = b
        }
    }

    /// One row per output channel, plus the constant added to each.
    var red: Row
    var green: Row
    var blue: Row
    var bias: Row

    static let identity = ColorMatrix(
        red: Row(1, 0, 0),
        green: Row(0, 1, 0),
        blue: Row(0, 0, 1),
        bias: Row(0, 0, 0)
    )

    var isIdentity: Bool { self == .identity }

    /// This matrix applied after `earlier`, as one matrix.
    func after(_ earlier: ColorMatrix) -> ColorMatrix {
        func row(_ weights: Row) -> Row {
            Row(
                weights.r * earlier.red.r + weights.g * earlier.green.r + weights.b * earlier.blue.r,
                weights.r * earlier.red.g + weights.g * earlier.green.g + weights.b * earlier.blue.g,
                weights.r * earlier.red.b + weights.g * earlier.green.b + weights.b * earlier.blue.b
            )
        }
        func offset(_ weights: Row, _ own: Double) -> Double {
            weights.r * earlier.bias.r
                + weights.g * earlier.bias.g
                + weights.b * earlier.bias.b
                + own
        }
        return ColorMatrix(
            red: row(red),
            green: row(green),
            blue: row(blue),
            bias: Row(
                offset(red, bias.r),
                offset(green, bias.g),
                offset(blue, bias.b)
            )
        )
    }

    /// The colour this matrix turns another into, for tests and for the swatch
    /// each filter shows.
    func apply(red r: Double, green g: Double, blue b: Double) -> (
        red: Double,
        green: Double,
        blue: Double
    ) {
        (
            red: min(1, max(0, red.r * r + red.g * g + red.b * b + bias.r)),
            green: min(1, max(0, green.r * r + green.g * g + green.b * b + bias.g)),
            blue: min(1, max(0, blue.r * r + blue.g * g + blue.b * b + bias.b))
        )
    }

    // MARK: - The filter functions, straight from the filter effects spec

    static func brightness(_ amount: Double) -> ColorMatrix {
        ColorMatrix(
            red: Row(amount, 0, 0),
            green: Row(0, amount, 0),
            blue: Row(0, 0, amount),
            bias: Row(0, 0, 0)
        )
    }

    static func contrast(_ amount: Double) -> ColorMatrix {
        let offset = 0.5 - 0.5 * amount
        return ColorMatrix(
            red: Row(amount, 0, 0),
            green: Row(0, amount, 0),
            blue: Row(0, 0, amount),
            bias: Row(offset, offset, offset)
        )
    }

    static func saturate(_ amount: Double) -> ColorMatrix {
        ColorMatrix(
            red: Row(
                0.213 + 0.787 * amount,
                0.715 - 0.715 * amount,
                0.072 - 0.072 * amount
            ),
            green: Row(
                0.213 - 0.213 * amount,
                0.715 + 0.285 * amount,
                0.072 - 0.072 * amount
            ),
            blue: Row(
                0.213 - 0.213 * amount,
                0.715 - 0.715 * amount,
                0.072 + 0.928 * amount
            ),
            bias: Row(0, 0, 0)
        )
    }

    static func grayscale(_ amount: Double) -> ColorMatrix {
        saturate(1 - min(1, max(0, amount)))
    }

    static func sepia(_ amount: Double) -> ColorMatrix {
        let keep = 1 - min(1, max(0, amount))
        return ColorMatrix(
            red: Row(
                0.393 + 0.607 * keep,
                0.769 - 0.769 * keep,
                0.189 - 0.189 * keep
            ),
            green: Row(
                0.349 - 0.349 * keep,
                0.686 + 0.314 * keep,
                0.168 - 0.168 * keep
            ),
            blue: Row(
                0.272 - 0.272 * keep,
                0.534 - 0.534 * keep,
                0.131 + 0.869 * keep
            ),
            bias: Row(0, 0, 0)
        )
    }

    static func hueRotate(degrees: Double) -> ColorMatrix {
        let radians = degrees * .pi / 180
        let cosine = cos(radians)
        let sine = sin(radians)
        return ColorMatrix(
            red: Row(
                0.213 + cosine * 0.787 - sine * 0.213,
                0.715 - cosine * 0.715 - sine * 0.715,
                0.072 - cosine * 0.072 + sine * 0.928
            ),
            green: Row(
                0.213 - cosine * 0.213 + sine * 0.143,
                0.715 + cosine * 0.285 + sine * 0.140,
                0.072 - cosine * 0.072 - sine * 0.283
            ),
            blue: Row(
                0.213 - cosine * 0.213 - sine * 0.787,
                0.715 - cosine * 0.715 + sine * 0.715,
                0.072 + cosine * 0.928 + sine * 0.072
            ),
            bias: Row(0, 0, 0)
        )
    }

    /// The same grade applied to a still, for the overlays the export burns in
    /// with Core Animation and the canvas draws by hand. Both would otherwise
    /// sit ungraded over footage that had been graded.
    func graded(_ image: CGImage) -> CGImage? {
        guard !isIdentity, let filter = coreImageFilter else { return image }
        let source = CIImage(cgImage: image)
        filter.setValue(source, forKey: kCIInputImageKey)
        guard let output = filter.outputImage else { return image }
        return CIContext().createCGImage(output, from: source.extent)
    }

    /// The Core Image filter that applies this matrix to a frame.
    var coreImageFilter: CIFilter? {
        let filter = CIFilter(name: "CIColorMatrix")
        filter?.setValue(CIVector(x: red.r, y: red.g, z: red.b, w: 0), forKey: "inputRVector")
        filter?.setValue(CIVector(x: green.r, y: green.g, z: green.b, w: 0), forKey: "inputGVector")
        filter?.setValue(CIVector(x: blue.r, y: blue.g, z: blue.b, w: 0), forKey: "inputBVector")
        filter?.setValue(CIVector(x: 0, y: 0, z: 0, w: 1), forKey: "inputAVector")
        filter?.setValue(CIVector(x: bias.r, y: bias.g, z: bias.b, w: 0), forKey: "inputBiasVector")
        return filter
    }
}
