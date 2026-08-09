import CoreGraphics
import Foundation

/// Settles a dragged overlay onto the lines of the frame worth hitting exactly,
/// and reports which of them to draw.
///
/// An overlay has three lines a guide can run through on each axis: its leading
/// edge, its centre and its trailing edge. Any of the three landing on a line of
/// the frame is worth catching, which is what makes an overlay sit flush to an
/// edge or share a centre with the caption under it. Snapping only the centre
/// to the frame's centre, which is what this used to do, meant the guides never
/// appeared in practice: dead centre is one position out of hundreds.
///
/// Thresholds are in points on screen rather than fractions of the frame, so the
/// pull feels the same whether the player is a thumbnail or fills the window.
enum OverlaySnapEngine {
    /// How close, in points on screen, a line has to come before it settles.
    static let snapDistance = 9.0

    /// The lines of the frame worth landing on: both edges, both thirds, and
    /// the centre.
    static let targets: [Double] = [0, 1.0 / 3.0, 0.5, 2.0 / 3.0, 1]

    /// One axis of a drag. `origin` is the box's leading edge and `extent` its
    /// size, both as fractions of the frame; `span` is how many points that
    /// frame is across, which is what turns the threshold into a distance.
    ///
    /// Returns where the box should sit, and the line to draw if it settled.
    static func snap(
        origin: Double,
        extent: Double,
        span: Double
    ) -> (origin: Double, guide: Double?) {
        guard span > 0 else { return (origin, nil) }

        var best: (distance: Double, origin: Double, guide: Double)?
        // Leading edge, centre, trailing edge.
        for reference in [0, extent / 2, extent] {
            for target in targets {
                let distance = abs(origin + reference - target) * span
                guard distance <= snapDistance else { continue }
                guard best == nil || distance < best!.distance else { continue }
                best = (distance, target - reference, target)
            }
        }

        guard let best else { return (origin, nil) }
        return (best.origin, best.guide)
    }
}
