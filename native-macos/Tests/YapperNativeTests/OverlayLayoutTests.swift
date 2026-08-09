import CoreGraphics
import Foundation
import Testing

@testable import YapperNative

/// The solver's whole job is a judgement call: keep the cutaway big, and keep
/// it off the speaker's face. These pin down what it does when it cannot have
/// both, because that is the case a creator notices.
struct OverlayLayoutTests {
    private let portrait = 9.0 / 16.0
    private let landscape = 16.0 / 9.0
    /// A wide file, which becomes a short strip in a tall frame.
    private let wideCard = 16.0 / 9.0
    /// A tall file, which becomes a column.
    private let tallCard = 9.0 / 16.0

    /// A face framed the way a phone frames one: centred across, head in the
    /// upper middle, shoulders below. Padded, this runs 0.27 to 0.63 down the
    /// frame, so there is room above it and room below it.
    private let face = CGRect(x: 0.32, y: 0.34, width: 0.36, height: 0.24)

    private var speaker: [SpeakerRegion] { SpeakerRegions.avoid(faces: [face]) }

    /// How much of the overlay is sitting on the padded face, as a share of the
    /// overlay itself. Zero is what a good placement looks like.
    private func faceShare(_ solved: OverlayBox) -> Double {
        guard let region = speaker.first else { return 0 }
        let box = CGRect(x: solved.x, y: solved.y, width: solved.width, height: solved.height)
        let hit = box.intersection(region.rect)
        guard !hit.isNull, box.width > 0, box.height > 0 else { return 0 }
        return (hit.width * hit.height) / (box.width * box.height)
    }

    /// A card that clears the speaker keeps the corner it was put in and opens
    /// out into the wall around it. Sitting small in the middle of all that
    /// room is what made a chart unreadable and looked like a postage stamp.
    @Test func aBoxThatClearsTheSpeakerOpensOutIntoTheRoomItHas() {
        let solved = OverlayLayout.solve(
            proposed: ProposedOverlayBox(x: 0.05, y: 0.04, width: 0.5),
            mediaAspect: wideCard,
            frameAspect: portrait,
            avoid: speaker
        )
        #expect(solved.width > 0.5)
        // Against the top left when it started there, rather than drifting to
        // the middle of the frame as it grew.
        #expect(solved.x == 0.05)
        #expect(solved.y == 0.04)
        // And not a pixel of it on the speaker: growth only takes empty space.
        #expect(faceShare(solved) == 0)
        // Height was never the model's to give.
        #expect(
            solved.height
                == OverlayFrame.height(
                    forWidth: solved.width,
                    mediaAspect: wideCard,
                    frameAspect: portrait
                )
        )
    }

    @Test func aCardIsNeverGrownPastTheSizeThatMakesItTheShot() {
        let solved = OverlayLayout.solve(
            proposed: ProposedOverlayBox(x: 0.05, y: 0.02, width: 0.3),
            mediaAspect: wideCard,
            frameAspect: portrait,
            avoid: speaker
        )
        #expect(solved.width <= OverlayLayout.maximumGrownWidth)
    }

    /// With nobody found in the shot there is nothing to grow away from, and
    /// guessing would be how a card ends up over a face nobody looked for.
    @Test func aCardIsNotGrownWhenTheSpeakerWasNeverFound() {
        let solved = OverlayLayout.solve(
            proposed: ProposedOverlayBox(x: 0.05, y: 0.04, width: 0.4),
            mediaAspect: wideCard,
            frameAspect: portrait,
            avoid: []
        )
        #expect(solved.width == 0.4)
    }

    /// The case this feature exists for. A wide file is a short strip in a tall
    /// frame, there is room above the head, and taking it costs nothing.
    @Test func aWideCardOnTheFaceMovesAboveItAtFullSize() {
        let solved = OverlayLayout.solve(
            proposed: ProposedOverlayBox(x: 0.2, y: 0.36, width: 0.6),
            mediaAspect: wideCard,
            frameAspect: portrait,
            avoid: speaker
        )
        #expect(faceShare(solved) == 0)
        // At least what was asked for, and more when the headroom allows it.
        #expect(solved.width >= 0.6)
        #expect(solved.y + solved.height <= face.minY)
    }

    /// A tall file cannot fit above a face. It has to go around one instead of
    /// shrinking until it fits in the gap beside it.
    @Test func aTallCardOnTheFaceMovesAroundItRatherThanShrinking() {
        let solved = OverlayLayout.solve(
            proposed: ProposedOverlayBox(x: 0.32, y: 0.3, width: 0.35),
            mediaAspect: tallCard,
            frameAspect: portrait,
            avoid: speaker
        )
        #expect(solved.width == 0.35)
        #expect(faceShare(solved) < 0.05)
    }

    @Test func aCutawayIsNeverSolvedSmallerThanACutaway() {
        // A face left almost nowhere to go: wide, tall, and centred.
        let crowded = SpeakerRegions.avoid(
            faces: [CGRect(x: 0.08, y: 0.08, width: 0.84, height: 0.7)]
        )
        let solved = OverlayLayout.solve(
            proposed: ProposedOverlayBox(x: 0.3, y: 0.3, width: 0.5),
            mediaAspect: wideCard,
            frameAspect: portrait,
            avoid: crowded
        )
        #expect(solved.width >= OverlayLayout.minimumWidth)
    }

    /// The anti-shrink rule, stated as the number it actually is. However bad
    /// the frame gets, a repair gives up at most a third of the width and then
    /// accepts the overlap: a smaller cutaway is worse than one that grazes a
    /// shoulder.
    @Test func aRepairNeverGivesUpMoreThanAThirdOfTheWidth() {
        let nowhereToGo = SpeakerRegions.avoid(
            faces: [CGRect(x: 0.02, y: 0.02, width: 0.96, height: 0.94)]
        )
        for width in [0.4, 0.55, 0.7] {
            let solved = OverlayLayout.solve(
                proposed: ProposedOverlayBox(x: 0.2, y: 0.3, width: width),
                mediaAspect: wideCard,
                frameAspect: portrait,
                avoid: nowhereToGo
            )
            #expect(solved.width >= min(width, max(OverlayLayout.minimumWidth, width * 0.7)))
        }
    }

    /// Room below the face is still room. A card that cannot go above the head
    /// belongs under it, at full size, rather than squeezed into a corner.
    @Test func aCardTooTallForTheHeadroomGoesBelowInstead() {
        let highFace = SpeakerRegions.avoid(
            faces: [CGRect(x: 0.3, y: 0.1, width: 0.4, height: 0.25)]
        )
        let solved = OverlayLayout.solve(
            proposed: ProposedOverlayBox(x: 0.25, y: 0.15, width: 0.6),
            mediaAspect: wideCard,
            frameAspect: portrait,
            avoid: highFace
        )
        #expect(solved.width >= 0.6)
        #expect(solved.y > 0.35)
    }

    @Test func aFullFrameCutawayIsNeverRepaired() {
        let solved = OverlayLayout.solve(
            proposed: ProposedOverlayBox(x: 0, y: 0, width: 1),
            mediaAspect: portrait,
            frameAspect: portrait,
            avoid: speaker
        )
        #expect(solved == OverlayBox(x: 0, y: 0, width: 1, height: 1))
    }

    /// Media cut to the frame's own shape is a graphic laid over the picture.
    /// Nothing is learned by asking where the face is.
    @Test func mediaCutForTheFrameCoversItEvenWithoutAProposal() {
        let solved = OverlayLayout.solve(
            proposed: nil,
            mediaAspect: portrait,
            frameAspect: portrait,
            avoid: speaker
        )
        #expect(solved == OverlayBox(x: 0, y: 0, width: 1, height: 1))
    }

    @Test func noProposalStartsFromTheCardAFreshOverlayWouldGet() {
        let solved = OverlayLayout.solve(
            proposed: nil,
            mediaAspect: wideCard,
            frameAspect: portrait,
            avoid: []
        )
        let introduced = OverlayFrame.introduced(mediaAspect: wideCard, frameAspect: portrait)
        #expect(solved.width == introduced.width)
        #expect(solved.x == introduced.x)
        #expect(solved.y == introduced.y)
    }

    @Test func nonsenseCoordinatesStillProduceABoxOnTheFrame() {
        let solved = OverlayLayout.solve(
            proposed: ProposedOverlayBox(x: -3, y: 9, width: 0.01),
            mediaAspect: wideCard,
            frameAspect: portrait,
            avoid: []
        )
        #expect(solved.width >= OverlayLayout.minimumWidth)
        #expect(solved.x >= 0)
        #expect(solved.y >= 0)
        #expect(solved.x + solved.width <= 1.0001)
        #expect(solved.y + solved.height <= 1.0001)
    }

    /// Tall media in a wide frame can want more height than the frame has. The
    /// frame wins; a box taller than the picture has nowhere to be placed.
    @Test func aBoxIsNeverTallerThanTheFrame() {
        let solved = OverlayLayout.solve(
            proposed: ProposedOverlayBox(x: 0.1, y: 0, width: 0.9),
            mediaAspect: tallCard,
            frameAspect: landscape,
            avoid: []
        )
        #expect(solved.height <= 1.0001)
    }

    @Test func aSolvedBoxIsDescribedInWordsACreatorWouldUse() {
        #expect(OverlayLayout.describe(OverlayBox(x: 0, y: 0, width: 1, height: 1)) == "full frame")
        #expect(
            OverlayLayout.describe(OverlayBox(x: 0.04, y: 0.04, width: 0.3, height: 0.2))
                == "top left"
        )
        #expect(
            OverlayLayout.describe(OverlayBox(x: 0.35, y: 0.04, width: 0.3, height: 0.2))
                == "top centre"
        )
        #expect(
            OverlayLayout.describe(OverlayBox(x: 0.04, y: 0.4, width: 0.3, height: 0.2)) == "left"
        )
        #expect(
            OverlayLayout.describe(OverlayBox(x: 0.66, y: 0.75, width: 0.3, height: 0.2))
                == "bottom right"
        )
        #expect(
            OverlayLayout.describe(OverlayBox(x: 0.35, y: 0.4, width: 0.3, height: 0.2)) == "centred"
        )
    }
}
