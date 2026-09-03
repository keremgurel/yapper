import Foundation

/// The named curves an animation may run on. Pure functions of progress, so
/// preview and export sample identical values.
enum SceneEasing: String, Codable, CaseIterable, Sendable {
    case linear
    case inQuad
    case outQuad
    case inOutQuad
    case outCubic
    case inOutCubic
    case outExpo
    case outBack

    static let `default` = SceneEasing.outCubic

    /// Eased progress for linear progress `t` in 0...1.
    func apply(_ t: Double) -> Double {
        let t = min(1, max(0, t))
        switch self {
        case .linear:
            return t
        case .inQuad:
            return t * t
        case .outQuad:
            return 1 - (1 - t) * (1 - t)
        case .inOutQuad:
            return t < 0.5 ? 2 * t * t : 1 - pow(-2 * t + 2, 2) / 2
        case .outCubic:
            return 1 - pow(1 - t, 3)
        case .inOutCubic:
            return t < 0.5 ? 4 * t * t * t : 1 - pow(-2 * t + 2, 3) / 2
        case .outExpo:
            return t >= 1 ? 1 : 1 - pow(2, -10 * t)
        case .outBack:
            let c1 = 1.70158
            let c3 = c1 + 1
            return 1 + c3 * pow(t - 1, 3) + c1 * pow(t - 1, 2)
        }
    }
}
