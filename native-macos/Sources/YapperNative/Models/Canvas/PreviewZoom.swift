import Foundation

/// How far the preview is pulled back from the size that fills the panel.
///
/// Nothing to do with `VideoFraming`: that is how much of the footage the
/// finished video shows, and this is only how large the finished video is drawn
/// while you work on it. Exporting cannot see it at all.
///
/// Zooming out exists because a picture zoomed past the frame has its corners
/// outside the frame, and a corner outside the frame is a corner you cannot
/// reach. Pulling the stage back puts them back on screen.
///
/// Zooming in exists for the opposite reason. Some of what the editor does is
/// measured in single pixels of a face: whether a blemish went, whether an edge
/// around a cut-out speaker is clean. Fitted, a 3072-pixel-tall frame is drawn
/// about 700 points high, and at that size neither is visible at all. Past the
/// fit the stage scrolls, which is what makes going past it worth anything.
struct PreviewZoom: Equatable, Sendable {
    /// As large as the panel allows, which is where the preview starts.
    static let fit = PreviewZoom(scale: 1)

    /// A quarter size shows a picture zoomed to the 4x the framing allows with
    /// its corners still on screen, and is small enough that going further
    /// would be looking at a thumbnail.
    static let minimumScale = 0.25

    /// Four times fitted, which on a 4K portrait frame in a laptop-sized panel
    /// is around actual pixels. Further than that is looking at the codec.
    static let maximumScale = 4.0

    /// One press is a visible step without being a jump.
    static let step = 0.1

    private(set) var scale: Double

    init(scale: Double) {
        self.scale = min(Self.maximumScale, max(Self.minimumScale, scale))
    }

    /// Exactly fitted, which is what the readout resets to.
    var isFit: Bool { scale == 1 }
    var isMaximum: Bool { scale >= Self.maximumScale }
    var isMinimum: Bool { scale <= Self.minimumScale }

    /// True when the stage is larger than the panel holding it, which is the
    /// only time there is anywhere to scroll to.
    var isPastFit: Bool { scale > 1 }

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
