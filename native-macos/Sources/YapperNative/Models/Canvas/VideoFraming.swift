import Foundation

/// How much of the speaker's own footage the finished frame shows, where, and
/// which way up.
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
/// `rotation` is in degrees clockwise about the middle of the frame, which is
/// also the point the zoom works about, so the three compose in one order and
/// mean the same thing at every scale.
struct VideoFraming: Codable, Equatable, Sendable {
    /// Read-only from outside, so the only way to hold one of these is to have
    /// gone through the initialiser that keeps it in range.
    private(set) var scale: Double
    private(set) var x: Double
    private(set) var y: Double
    private(set) var rotation: Double

    /// Fitted, centred and upright: what the main track did before framing
    /// existed.
    static let identity = VideoFraming(scale: 1, x: 0, y: 0)

    /// Small enough to sit the footage in a corner, large enough to punch into
    /// a face. Past either end the picture stops being footage and starts being
    /// a mistake.
    static let minimumScale = 0.2
    static let maximumScale = 5.0
    /// Far enough to push the picture right out of the frame, which is a
    /// legitimate thing to want while arranging a shot, and no further.
    static let maximumOffset = 1.5

    init(scale: Double, x: Double, y: Double, rotation: Double = 0) {
        self.scale = min(Self.maximumScale, max(Self.minimumScale, scale))
        self.x = min(Self.maximumOffset, max(-Self.maximumOffset, x))
        self.y = min(Self.maximumOffset, max(-Self.maximumOffset, y))
        self.rotation = Self.wrap(rotation)
    }

    /// The same framing with one thing about it changed, so a caller that only
    /// has an opinion about the zoom does not have to restate the rest and
    /// cannot quietly drop the part it forgot.
    func with(
        scale: Double? = nil,
        x: Double? = nil,
        y: Double? = nil,
        rotation: Double? = nil
    ) -> VideoFraming {
        VideoFraming(
            scale: scale ?? self.scale,
            x: x ?? self.x,
            y: y ?? self.y,
            rotation: rotation ?? self.rotation
        )
    }

    var isIdentity: Bool { self == .identity }

    /// What the inspector shows and the readout reads: 100% is the fitted size.
    var percent: Int { Int((scale * 100).rounded()) }

    var rotationRadians: Double { rotation * .pi / 180 }

    /// Turning a picture 190° clockwise and 170° anticlockwise are the same
    /// picture, and a creator dragging a rotate handle round and round should
    /// not be able to bank up a number that reads as nonsense. Kept in
    /// (-180, 180] so the two readouts agree.
    static func wrap(_ degrees: Double) -> Double {
        guard degrees.isFinite else { return 0 }
        var value = degrees.truncatingRemainder(dividingBy: 360)
        if value > 180 { value -= 360 }
        if value <= -180 { value += 360 }
        // -0 reads back as a different number from 0 in a text field.
        return value == 0 ? 0 : value
    }
}

// MARK: - Codable

extension VideoFraming {
    private enum CodingKeys: String, CodingKey {
        case scale, x, y, rotation
    }

    /// Written by hand rather than synthesised so a project saved before
    /// rotation existed reads back upright, and so every route in goes through
    /// the clamping the initialiser does.
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.init(
            scale: try container.decode(Double.self, forKey: .scale),
            x: try container.decode(Double.self, forKey: .x),
            y: try container.decode(Double.self, forKey: .y),
            rotation: try container.decodeIfPresent(Double.self, forKey: .rotation) ?? 0
        )
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(scale, forKey: .scale)
        try container.encode(x, forKey: .x)
        try container.encode(y, forKey: .y)
        // Left out when it is nothing, so an upright project reads the same as
        // it did before rotation existed.
        if rotation != 0 { try container.encode(rotation, forKey: .rotation) }
    }
}

extension TimelineClip {
    /// A clip saved before framing existed is fitted, which is what it always
    /// looked like.
    var resolvedFraming: VideoFraming { framing ?? .identity }
}
