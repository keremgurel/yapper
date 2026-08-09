import Foundation

/// How far the preview is pulled back from the size that fills the panel.
///
/// Nothing to do with `VideoFraming`: that is how much of the footage the
/// finished video shows, and this is only how large the finished video is drawn
/// while you work on it. Exporting cannot see it at all.
///
/// It exists because a picture zoomed past the frame has its corners outside
/// the frame, and a corner outside the frame is a corner you cannot reach.
/// Pulling the stage back puts them back on screen. Fitted is as large as it
/// goes: the panel does not scroll, so growing past the fit would push the
/// picture under the timeline.
struct PreviewZoom: Equatable, Sendable {
    /// As large as the panel allows, which is where the preview starts.
    static let fit = PreviewZoom(scale: 1)

    /// A quarter size shows a picture zoomed to the 4x the framing allows with
    /// its corners still on screen, and is small enough that going further
    /// would be looking at a thumbnail.
    static let minimumScale = 0.25
    static let maximumScale = 1.0

    /// One press is a visible step without being a jump.
    static let step = 0.1

    private(set) var scale: Double

    init(scale: Double) {
        self.scale = min(Self.maximumScale, max(Self.minimumScale, scale))
    }

    var isFit: Bool { scale >= Self.maximumScale }
    var isMinimum: Bool { scale <= Self.minimumScale }

    /// What the readout shows: 100% is fitted to the panel, not the footage's
    /// own pixels, which no one is counting here.
    var percent: Int { Int((scale * 100).rounded()) }

    func stepped(by delta: Double) -> PreviewZoom {
        PreviewZoom(scale: scale + delta)
    }

    /// For a pinch, which reports a factor rather than a distance.
    func scaled(by factor: Double) -> PreviewZoom {
        PreviewZoom(scale: scale * factor)
    }
}
