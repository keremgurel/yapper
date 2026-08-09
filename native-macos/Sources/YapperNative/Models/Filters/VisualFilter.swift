import Foundation

/// The looks a project can be graded with. The same seven the web studio
/// offers, with the same numbers, so a video cut in either place looks the same.
enum VisualFilterID: String, Codable, CaseIterable, Identifiable, Sendable {
    case original
    case clean
    case warm
    case cool
    case punch
    case mono
    case fade

    var id: String { rawValue }

    var title: String {
        switch self {
        case .original: "Original"
        case .clean: "Clean"
        case .warm: "Warm"
        case .cool: "Cool"
        case .punch: "Punch"
        case .mono: "Mono"
        case .fade: "Fade"
        }
    }

    var hint: String {
        switch self {
        case .original: "No filter"
        case .clean: "Bright and crisp"
        case .warm: "Soft warmth"
        case .cool: "Blue balance"
        case .punch: "Bold contrast"
        case .mono: "Black and white"
        case .fade: "Soft film wash"
        }
    }

    /// Brightness, contrast, saturation, sepia, hue rotation and grayscale at
    /// full strength.
    var target: (
        brightness: Double,
        contrast: Double,
        saturation: Double,
        sepia: Double,
        hue: Double,
        grayscale: Double
    ) {
        switch self {
        case .original: (1, 1, 1, 0, 0, 0)
        case .clean: (1.05, 1.08, 0.98, 0, 0, 0)
        case .warm: (1.03, 1.06, 1.12, 0.08, -4, 0)
        case .cool: (1.01, 1.06, 1.06, 0, 9, 0)
        case .punch: (1.01, 1.2, 1.22, 0, 0, 0)
        case .mono: (1.02, 1.14, 0.9, 0, 0, 1)
        case .fade: (1.06, 0.86, 0.82, 0.04, 0, 0)
        }
    }
}

/// A look and how much of it.
struct VisualFilter: Codable, Equatable, Sendable {
    var id: VisualFilterID
    /// 0 leaves the picture alone, 1 is the whole look.
    var strength: Double

    static let none = VisualFilter(id: .original, strength: 1)

    init(id: VisualFilterID = .original, strength: Double = 1) {
        self.id = id
        self.strength = strength
    }

    var isNeutral: Bool { id == .original || strength <= 0 }

    /// The whole grade as one colour transform, in the order the browser
    /// applies them: brightness, contrast, saturation, sepia, hue, grayscale.
    var colorMatrix: ColorMatrix {
        guard !isNeutral else { return .identity }
        let amount = min(1, max(0, strength))
        let target = id.target
        func lerp(_ from: Double, _ to: Double) -> Double { from + (to - from) * amount }

        var matrix = ColorMatrix.brightness(lerp(1, target.brightness))
        matrix = ColorMatrix.contrast(lerp(1, target.contrast)).after(matrix)
        matrix = ColorMatrix.saturate(lerp(1, target.saturation)).after(matrix)
        if target.sepia != 0 {
            matrix = ColorMatrix.sepia(lerp(0, target.sepia)).after(matrix)
        }
        if target.hue != 0 {
            matrix = ColorMatrix.hueRotate(degrees: lerp(0, target.hue)).after(matrix)
        }
        if target.grayscale != 0 {
            matrix = ColorMatrix.grayscale(lerp(0, target.grayscale)).after(matrix)
        }
        return matrix
    }
}
