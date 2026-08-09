import Foundation

/// How much of the speaker's own footage the finished frame shows, and where.
///
/// The main track has always been fitted: scaled until the whole picture is
/// inside the output frame, and centred. That is the right default and the
/// wrong answer often enough to be worth an escape hatch, because the common
/// case is landscape footage in a portrait frame, where fitting leaves half the
/// screen black. Zooming past the fit and sliding the picture until the speaker
/// is where you want them is the whole point of this value.
///
/// `scale` is a multiple of the fitted size, so 1 is exactly the behaviour every
/// project had before this existed and `nil` on a clip reads as 1. `x` and `y`
/// are how far the picture is pushed off centre, in fractions of the output
/// frame, positive being right and down: the same directions the canvas uses.
struct VideoFraming: Codable, Equatable, Sendable {
    /// Read-only from outside, so the only way to hold one of these is to have
    /// gone through the initialiser that keeps it in range.
    private(set) var scale: Double
    private(set) var x: Double
    private(set) var y: Double

    /// Fitted and centred: what the main track did before framing existed.
    static let identity = VideoFraming(scale: 1, x: 0, y: 0)

    /// Small enough to sit the footage in a corner, large enough to punch into
    /// a face. Past either end the picture stops being footage and starts being
    /// a mistake.
    static let minimumScale = 0.2
    static let maximumScale = 5.0
    /// Far enough to push the picture right out of the frame, which is a
    /// legitimate thing to want while arranging a shot, and no further.
    static let maximumOffset = 1.5

    init(scale: Double, x: Double, y: Double) {
        self.scale = min(Self.maximumScale, max(Self.minimumScale, scale))
        self.x = min(Self.maximumOffset, max(-Self.maximumOffset, x))
        self.y = min(Self.maximumOffset, max(-Self.maximumOffset, y))
    }

    var isIdentity: Bool { self == .identity }

    /// What the inspector shows and the readout reads: 100% is the fitted size.
    var percent: Int { Int((scale * 100).rounded()) }
}

extension TimelineClip {
    /// A clip saved before framing existed is fitted, which is what it always
    /// looked like.
    var resolvedFraming: VideoFraming { framing ?? .identity }
}
