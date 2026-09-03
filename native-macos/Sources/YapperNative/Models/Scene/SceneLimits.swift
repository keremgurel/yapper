import Foundation

/// The caps in docs/overlay-scene-format.md, mirrored by the web validator's
/// `SCENE_LIMITS`. Change the document first, then both.
enum SceneLimits {
    static let version = 1
    static let maxNodes = 64
    static let maxAnimations = 96
    static let maxTextLength = 120
    static let maxPathBytes = 4096
    static let maxIdLength = 40
    static let maxGroupDepth = 3
    static let maxImages = 2
    static let duration = 0.5 ... 30.0
    static let position = -0.5 ... 1.5
    static let size = 0.001 ... 1.5
    static let textSize = 0.01 ... 1.0
    static let strokeWidth = 0.0 ... 0.2
    static let cornerRadius = 0.0 ... 1.0
    static let lineHeight = 0.8 ... 2.0
    static let stagger = 0.0 ... 2.0
    /// Text shorter than this fraction of the frame height is unreadable.
    static let minLegibleFrameFraction = 0.022
    /// Where the library still is taken when the designer did not say.
    static let defaultPosterFraction = 0.6
}
