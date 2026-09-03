import CoreGraphics
import Foundation

/// Where the model asked for an overlay to sit, as fractions of the frame.
///
/// Height is deliberately absent. It is always derived from the width and the
/// media's own shape, so nothing the model returns can squash a picture.
struct ProposedOverlayBox: Equatable, Sendable {
    var x: Double
    var y: Double
    var width: Double
}

/// An overlay's box on the frame, ready to be saved.
struct OverlayBox: Codable, Equatable, Sendable {
    var x: Double
    var y: Double
    var width: Double
    var height: Double
}

/// Taking the box the model asked for and making it one the frame can live with.
///
/// The model proposes; this repairs. It is not a second opinion: a proposal that
/// already clears the speaker is returned exactly as it came, because the model
/// saw the transcript and knows what the shot is about. Only a box that actually
/// lands on a face is moved, and then the search is biased hard against
/// shrinking: a card that overlaps a shoulder at full size beats one shrunk to a
/// stamp to squeeze into a gap.
///
/// Pure arithmetic on fractions, in the same spirit as `OverlayCanvasGeometry`.
enum OverlayLayout {
    /// No overlay is ever solved smaller than this share of the frame's width.
    /// Below it a cutaway stops being a shot and becomes a sticker.
    static let minimumWidth = 0.22

    /// The largest a card is grown to when the shot has room for it. Past this
    /// it stops being something laid on the shot and becomes the shot.
    static let maximumGrownWidth = 0.86
    /// How much of a step growth takes. Small enough to find the edge of the
    /// clear space, large enough not to score two dozen boxes to get there.
    private static let growStep = 0.06
    /// How close to an edge counts as sitting against it, and therefore as an
    /// edge to grow away from rather than across.
    private static let anchorTolerance = 0.02
    /// How far a solved box is held off the edges.
    static let margin = 0.04
    /// Face overlap this small is not worth moving a good placement for.
    static let overlapTolerance = 0.04

    /// What losing width costs, against covering the speaker.
    ///
    /// Tuned so that shrinking a 0.42-wide card to 0.30 costs the same as
    /// covering 12% of the overlay in face: `0.42 * (1 - 0.30/0.42) == 0.12`.
    /// That is the whole point of the solver, expressed as one number.
    static let shrinkWeight = 0.42

    /// Nudges, small enough to only ever settle a tie: stay near where the
    /// model put it, and prefer the top of the frame when nothing else decides.
    private static let driftWeight = 0.03
    private static let lowerHalfWeight = 0.008

    /// How close the media's shape has to be to the frame's to count as cut for
    /// it. Matches `OverlayFrame`'s own tolerance.
    private static let aspectTolerance = 0.04

    /// The width ladder a repair may walk down, as shares of what was asked for.
    private static let shrinkSteps = [1.0, 0.92, 0.85, 0.78, 0.7]

    /// The box an overlay should be given.
    ///
    /// - Parameters:
    ///   - proposed: what the model asked for, or nil when it said nothing, in
    ///     which case the card `OverlayFrame.introduced` would have given is
    ///     used as the starting point instead.
    ///   - mediaAspect: the shape of what the overlay shows, crop included.
    ///     `EditorSession.aspects(for:)` already returns this.
    ///   - avoid: the speaker, plus anything else already on screen.
    /// Whether a box may cover the whole frame.
    ///
    /// An imported file cut to the video's own shape is a graphic laid over
    /// the picture, and covering the frame is what it is for. A generated
    /// scene never is: its aspect is the shape of the card the designer was
    /// given, and one that happens to match the video is still a card that
    /// has to clear the speaker. Without this the solver read "frame shaped"
    /// as "full frame" and put a generated comparison over the whole shot.
    enum FullFramePolicy: Sendable {
        case allowed
        case never
    }

    static func solve(
        proposed: ProposedOverlayBox?,
        mediaAspect: Double,
        frameAspect: Double,
        avoid: [SpeakerRegion],
        fullFrame: FullFramePolicy = .allowed
    ) -> OverlayBox {
        let introduced = OverlayFrame.introduced(
            mediaAspect: mediaAspect,
            frameAspect: frameAspect,
            allowFullFrame: fullFrame == .allowed
        )
        let seed = proposed ?? ProposedOverlayBox(
            x: introduced.x,
            y: introduced.y,
            width: introduced.width
        )

        // Media cut to the frame's own shape is a graphic laid over the whole
        // picture, not a card sitting on it. Asking where the face is misses
        // the point of it, so it is never repaired.
        if fullFrame == .allowed, seed.width >= 0.98,
           isFrameShaped(mediaAspect: mediaAspect, frameAspect: frameAspect)
        {
            return OverlayBox(x: 0, y: 0, width: 1, height: 1)
        }

        let start = normalised(seed, mediaAspect: mediaAspect, frameAspect: frameAspect)
        guard !avoid.isEmpty else { return start }
        if overlap(start, avoid: avoid) <= overlapTolerance {
            return grown(start, mediaAspect: mediaAspect, frameAspect: frameAspect, avoid: avoid)
        }

        var best = start
        var bestCost = cost(start, proposedWidth: start.width, near: seed, avoid: avoid)
        for candidate in candidates(from: start, mediaAspect: mediaAspect, frameAspect: frameAspect) {
            let candidateCost = cost(
                candidate,
                proposedWidth: start.width,
                near: seed,
                avoid: avoid
            )
            guard candidateCost < bestCost else { continue }
            best = candidate
            bestCost = candidateCost
        }
        return grown(best, mediaAspect: mediaAspect, frameAspect: frameAspect, avoid: avoid)
    }

    /// A card opened out into the empty part of the shot, stopping before it
    /// reaches the speaker.
    ///
    /// Everything above only ever makes a box smaller: the model proposes a
    /// size and the solver's job was to keep that size off the speaker's face.
    /// That leaves the common shot badly served. Somebody talking to camera
    /// usually has a wall behind them and a good deal of it above their head,
    /// and a modest card asked for in the corner sat in the middle of all that
    /// room looking like a postage stamp, when the same card at twice the width
    /// would have covered nothing but wall.
    ///
    /// Only ever grown into space known to be clear. With no speaker regions
    /// there is nothing to check against, and not knowing where the speaker is
    /// is not a licence to cover them, so the proposal is left exactly as it
    /// came.
    static func grown(
        _ box: OverlayBox,
        mediaAspect: Double,
        frameAspect: Double,
        avoid: [SpeakerRegion]
    ) -> OverlayBox {
        guard !avoid.isEmpty, box.width < maximumGrownWidth else { return box }
        var width = maximumGrownWidth
        while width > box.width + 0.001 {
            let candidate = anchored(
                box,
                toWidth: width,
                mediaAspect: mediaAspect,
                frameAspect: frameAspect
            )
            // Nothing at all, not `overlapTolerance`. That tolerance is for
            // leaving a good placement alone when it grazes a shoulder;
            // spending it here would mean choosing to grow onto the speaker,
            // which is the opposite of the point. Growth only takes space that
            // is empty.
            if overlap(candidate, avoid: avoid) <= 0.0001 { return candidate }
            width -= growStep
        }
        return box
    }

    /// The same box at a new width, growing away from whatever it is sitting
    /// against.
    ///
    /// A card in the top right belongs in the top right: opening it out about
    /// its centre would walk it off the corner the model chose it for. So an
    /// edge already against the frame stays against the frame, and only the
    /// free sides move. A box against nothing grows evenly about its middle.
    private static func anchored(
        _ box: OverlayBox,
        toWidth width: Double,
        mediaAspect: Double,
        frameAspect: Double
    ) -> OverlayBox {
        let sized = normalised(
            ProposedOverlayBox(x: box.x, y: box.y, width: width),
            mediaAspect: mediaAspect,
            frameAspect: frameAspect
        )
        return OverlayBox(
            x: OverlayCanvasGeometry.clampedOrigin(
                anchoredOrigin(origin: box.x, extent: box.width, grownExtent: sized.width),
                extent: sized.width
            ),
            y: OverlayCanvasGeometry.clampedOrigin(
                anchoredOrigin(origin: box.y, extent: box.height, grownExtent: sized.height),
                extent: sized.height
            ),
            width: sized.width,
            height: sized.height
        )
    }

    private static func anchoredOrigin(
        origin: Double,
        extent: Double,
        grownExtent: Double
    ) -> Double {
        if origin <= margin + anchorTolerance { return origin }
        if origin + extent >= 1 - margin - anchorTolerance { return origin + extent - grownExtent }
        return origin + extent / 2 - grownExtent / 2
    }

    /// A proposal with the media's own shape, inside the frame, and no smaller
    /// than a cutaway is allowed to be. Everything downstream can assume this.
    static func normalised(
        _ proposed: ProposedOverlayBox,
        mediaAspect: Double,
        frameAspect: Double
    ) -> OverlayBox {
        var width = min(1, max(minimumWidth, proposed.width.isFinite ? proposed.width : minimumWidth))
        var height = OverlayFrame.height(
            forWidth: width,
            mediaAspect: mediaAspect,
            frameAspect: frameAspect
        )
        // Tall media in a wide frame can want more height than there is. The
        // frame wins: a box taller than the picture has nowhere to be placed.
        if height > 1 {
            width /= height
            height = 1
        }
        return OverlayBox(
            x: OverlayCanvasGeometry.clampedOrigin(
                proposed.x.isFinite ? proposed.x : 0,
                extent: width
            ),
            y: OverlayCanvasGeometry.clampedOrigin(
                proposed.y.isFinite ? proposed.y : 0,
                extent: height
            ),
            width: width,
            height: height
        )
    }

    /// Every box worth scoring: eight anchors and the four slides along one
    /// axis, each at every rung of the width ladder.
    private static func candidates(
        from start: OverlayBox,
        mediaAspect: Double,
        frameAspect: Double
    ) -> [OverlayBox] {
        var result: [OverlayBox] = []
        var seenWidths: [Double] = []

        for step in shrinkSteps {
            let width = max(minimumWidth, start.width * step)
            // The ladder bottoms out at the minimum, so the last rungs can
            // repeat. Scoring the same width twice only costs time.
            guard !seenWidths.contains(where: { abs($0 - width) < 0.001 }) else { continue }
            seenWidths.append(width)

            let box = normalised(
                ProposedOverlayBox(x: start.x, y: start.y, width: width),
                mediaAspect: mediaAspect,
                frameAspect: frameAspect
            )
            let left = margin
            let right = max(margin, 1 - box.width - margin)
            let centreX = (1 - box.width) / 2
            let top = margin
            let bottom = max(margin, 1 - box.height - margin)
            let centreY = (1 - box.height) / 2

            let origins: [(Double, Double)] = [
                (left, top), (centreX, top), (right, top),
                (left, centreY), (right, centreY),
                (left, bottom), (centreX, bottom), (right, bottom),
                // Slid along one axis only, so a proposal that was right about
                // where to be horizontally keeps that and only moves up or down.
                (box.x, top), (box.x, bottom),
                (left, box.y), (right, box.y),
            ]
            for origin in origins {
                result.append(
                    OverlayBox(
                        x: OverlayCanvasGeometry.clampedOrigin(origin.0, extent: box.width),
                        y: OverlayCanvasGeometry.clampedOrigin(origin.1, extent: box.height),
                        width: box.width,
                        height: box.height
                    )
                )
            }
        }
        return result
    }

    /// What a box costs: how much of the speaker it covers, plus what it gave
    /// up in size to get there, plus the two nudges that settle ties.
    private static func cost(
        _ box: OverlayBox,
        proposedWidth: Double,
        near proposed: ProposedOverlayBox,
        avoid: [SpeakerRegion]
    ) -> Double {
        let shrink: Double = proposedWidth > 0 ? max(0, 1 - box.width / proposedWidth) : 0
        let centre: Double = box.x + box.width / 2
        let wanted: Double = proposed.x + proposed.width / 2
        let drift: Double = abs(centre - wanted) + abs(box.y - proposed.y)
        let depth: Double = box.y + box.height / 2

        var total = overlap(box, avoid: avoid)
        total += shrinkWeight * shrink
        total += driftWeight * drift
        total += lowerHalfWeight * depth
        return total
    }

    /// The share of the overlay covering something it should not, weighted by
    /// how much that thing matters. Measured against the overlay's own area, so
    /// a small card on a face is judged as harshly as a large one.
    static func overlap(_ box: OverlayBox, avoid: [SpeakerRegion]) -> Double {
        let rect = CGRect(x: box.x, y: box.y, width: box.width, height: box.height)
        let area = rect.width * rect.height
        guard area > 0 else { return 0 }
        return avoid.reduce(0) { total, region in
            let hit = rect.intersection(region.rect)
            guard !hit.isNull, hit.width > 0, hit.height > 0 else { return total }
            return total + (hit.width * hit.height) / area * region.weight
        }
    }

    /// Where a solved box ended up, in the words a creator would use.
    ///
    /// The placement panel lists what it did, and "top left" is the part of
    /// that list a person can check against the player without clicking
    /// anything.
    static func describe(_ box: OverlayBox) -> String {
        guard box.width < 0.98 || box.height < 0.98 else { return "full frame" }
        let midX = box.x + box.width / 2
        let midY = box.y + box.height / 2
        let vertical = midY < 0.38 ? "top" : (midY > 0.62 ? "bottom" : "")
        let horizontal = midX < 0.38 ? "left" : (midX > 0.62 ? "right" : "")
        if vertical.isEmpty { return horizontal.isEmpty ? "centred" : horizontal }
        return "\(vertical) \(horizontal.isEmpty ? "centre" : horizontal)"
    }

    private static func isFrameShaped(mediaAspect: Double, frameAspect: Double) -> Bool {
        guard frameAspect > 0 else { return false }
        return abs(mediaAspect - frameAspect) / frameAspect <= aspectTolerance
    }
}
