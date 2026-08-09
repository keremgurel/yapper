import CoreGraphics
import Foundation

/// Laying a set of overlays out as one row: same height, same baseline, side by
/// side, in the order they are spoken.
///
/// "Show the Instagram and TikTok icons" is one request, not two. Solved
/// separately they land in two unrelated corners, at two sizes, because nothing
/// tells either solver the other exists. So the row is placed as a single box
/// and cut into slots afterwards, which means one decision about where it goes
/// and one about how big it is.
///
/// Pure arithmetic on fractions, like `OverlayLayout`, which does the actual
/// placing here.
enum OverlayRowLayout {
    /// The space between two slots, as a fraction of the frame's width. Enough
    /// to read as two things rather than one wide picture.
    static let gap = 0.03

    /// How wide a row starts out wanting to be. Wider than one card, because a
    /// row is carrying several things, and short of the full width so it never
    /// reads as a banner.
    static let defaultWidth = 0.66

    /// One thing in the row, in the order it should be read.
    struct Member: Equatable, Sendable {
        /// The shape of what it shows, crop included.
        let mediaAspect: Double
    }

    /// The row, cut into one box per member.
    ///
    /// - Parameters:
    ///   - members: in the order they should appear, left to right. Callers sort
    ///     by when each is spoken, so the icons read in the order the platforms
    ///     are named.
    ///   - proposedWidth: how wide the model asked the row to be, if it said.
    ///   - avoid: the speaker across everywhere the row is on screen, plus
    ///     anything already there.
    static func solve(
        members: [Member],
        proposedWidth: Double?,
        proposedOrigin: (x: Double, y: Double)?,
        frameAspect: Double,
        avoid: [SpeakerRegion]
    ) -> [OverlayBox] {
        let shapes = members.map { max(0.01, $0.mediaAspect) }
        guard !shapes.isEmpty, frameAspect > 0 else { return [] }

        let wanted = min(1, max(OverlayLayout.minimumWidth, proposedWidth ?? defaultWidth))
        let row = fitted(shapes: shapes, toWidth: wanted, frameAspect: frameAspect)
        guard row.height > 0, row.width > 0 else { return [] }

        // The row is placed as though it were one piece of media of its own
        // shape, so it gets face avoidance and the anti-shrink rule from the
        // solver that already has both, rather than a second copy of either.
        let solved = OverlayLayout.solve(
            proposed: ProposedOverlayBox(
                x: proposedOrigin?.x ?? (1 - row.width) / 2,
                y: proposedOrigin?.y ?? OverlayLayout.margin,
                width: row.width
            ),
            mediaAspect: rowAspect(row, frameAspect: frameAspect),
            frameAspect: frameAspect,
            avoid: avoid
        )

        // The solver may have shrunk the row to clear a face. Every slot shrinks
        // with it, by the same amount, or they stop being a row.
        let scale = row.width > 0 ? solved.width / row.width : 1
        var cursor = solved.x
        return row.widths.map { width in
            let slot = OverlayBox(
                x: cursor,
                y: solved.y,
                width: width * scale,
                height: solved.height
            )
            cursor += width * scale + gap * scale
            return slot
        }
    }

    /// The slot widths that give every member the same height, and the row they
    /// add up to.
    ///
    /// Height, not width, is what is shared. "Aligned same height" is what a row
    /// of icons looks like, and equal widths would make a wide logo and a square
    /// one visibly different sizes.
    ///
    /// Widths are fractions of the frame's width and heights of its height, so
    /// the frame's own shape has to come into it, exactly as in
    /// `OverlayFrame.height(forWidth:mediaAspect:frameAspect:)`.
    static func fitted(
        shapes: [Double],
        toWidth width: Double,
        frameAspect: Double
    ) -> (widths: [Double], width: Double, height: Double) {
        let gaps = gap * Double(max(0, shapes.count - 1))
        let forSlots = max(0.01, width - gaps)
        let shapeTotal = shapes.reduce(0, +)
        guard shapeTotal > 0 else { return ([], 0, 0) }

        var height = forSlots * frameAspect / shapeTotal
        // A row cannot be taller than the frame it sits in.
        if height > 1 { height = 1 }
        let widths = shapes.map { height * $0 / frameAspect }
        return (widths, widths.reduce(0, +) + gaps, height)
    }

    /// The shape of the row itself, so it can be placed as one piece of media.
    private static func rowAspect(
        _ row: (widths: [Double], width: Double, height: Double),
        frameAspect: Double
    ) -> Double {
        guard row.height > 0 else { return frameAspect }
        return (row.width / row.height) * frameAspect
    }
}
