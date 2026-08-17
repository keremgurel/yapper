import Foundation

/// How much retouching a clip gets.
///
/// Two settings. Every editor that offers this offers a dozen, and the other
/// ten are the ones that make a face look like a mannequin: skin plumping, face
/// slimming, eye enlarging. Clearing a spot and taking the yellow off a tooth
/// are the two that leave someone looking like themselves on a better day.
///
/// Both are fractions from nothing to full. Nothing is the default and costs
/// nothing to render: a clip at zero is not retouched at all rather than
/// retouched by zero.
struct ClipRetouch: Codable, Equatable, Sendable {
    var clearBlemishes: Double
    var whitenTeeth: Double

    static let none = ClipRetouch(clearBlemishes: 0, whitenTeeth: 0)

    init(clearBlemishes: Double = 0, whitenTeeth: Double = 0) {
        self.clearBlemishes = ClipRetouch.clamped(clearBlemishes)
        self.whitenTeeth = ClipRetouch.clamped(whitenTeeth)
    }

    /// True when this would change nothing, which is what keeps an untouched
    /// clip off the slow path.
    var isNeutral: Bool { clearBlemishes <= 0 && whitenTeeth <= 0 }

    /// True when the face has to be found on every frame.
    var needsFace: Bool { !isNeutral }

    private static func clamped(_ value: Double) -> Double {
        guard value.isFinite else { return 0 }
        return min(1, max(0, value))
    }
}
