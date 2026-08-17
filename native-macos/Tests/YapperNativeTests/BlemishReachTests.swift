import CoreGraphics
import Foundation
import Testing
@testable import YapperNative

/// How far the detector is allowed to look, which turned out to be the whole
/// bug rather than a detail of it.
///
/// Vision's face box stops at the eyebrows. A detector working inside that box
/// examines the cheeks and the chin and never once looks at the forehead, which
/// on most faces is where the spots actually are. Measured on real footage: the
/// mask fired seven times around the nose and not once on a forehead carrying
/// several visible marks.
///
/// The fix grows the region upward. These pin both halves of that, because the
/// obvious way to grow it is evenly, and reaching the same distance downward
/// puts the region on a neck, where the shadow under a jaw and the marks left
/// by shaving read as blemishes on every frame.
struct BlemishReachTests {
    /// A box the size Vision returns: chin at the bottom, eyebrows at the top.
    private static let visionBox = CGRect(x: 200, y: 400, width: 600, height: 600)

    @Test("The forehead above Vision's box is part of the face")
    func theForeheadIsReached() {
        let brow = Self.visionBox.maxY
        let onTheForehead = CGPoint(
            x: Self.visionBox.midX,
            y: brow + Self.visionBox.height * 0.2
        )
        #expect(BlemishDetector.isOnTheFace(onTheForehead, face: Self.visionBox))
    }

    /// The whole point of growing upward rather than evenly.
    @Test("The neck below the chin is not")
    func theNeckIsNotReached() {
        let chin = Self.visionBox.minY
        let onTheNeck = CGPoint(
            x: Self.visionBox.midX,
            y: chin - Self.visionBox.height * 0.05
        )
        #expect(!BlemishDetector.isOnTheFace(onTheNeck, face: Self.visionBox))
    }

    @Test("The face reaches further up than Vision's box does")
    func theRegionIsTallerThanTheBox() {
        let whole = BlemishDetector.fullFace(Self.visionBox)
        #expect(whole.maxY > Self.visionBox.maxY)
        // Grown at one end only: the chin is where the face stops.
        #expect(whole.minY == Self.visionBox.minY)
        #expect(whole.width == Self.visionBox.width)
    }

    /// Far enough to clear a hairline. A forehead is roughly a third of a
    /// box-height above the brow, and a reach that stopped short of it would
    /// pass the test above while still missing most of the spots.
    @Test("The reach clears the hairline rather than just the brow")
    func theReachIsEnoughToMatter() {
        #expect(BlemishDetector.foreheadReach >= 0.3)
        // Not so far that the region climbs into hair, which is dark enough to
        // be rejected but wastes the working resolution the detector has.
        #expect(BlemishDetector.foreheadReach <= 0.5)
    }

    @Test("A point off to the side of the head is not on the face")
    func theSidesAreStillBounded() {
        let beside = CGPoint(
            x: Self.visionBox.maxX + Self.visionBox.width * 0.2,
            y: Self.visionBox.midY
        )
        #expect(!BlemishDetector.isOnTheFace(beside, face: Self.visionBox))
    }

    @Test("A face with no size is on nothing")
    func aDegenerateFaceIsIgnored() {
        let empty = CGRect(x: 10, y: 10, width: 0, height: 0)
        #expect(!BlemishDetector.isOnTheFace(CGPoint(x: 10, y: 10), face: empty))
    }
}

/// The same region measured from the top left, which is how `FaceDetectionService`
/// hands its boxes out and therefore how the canvas indicator draws them.
struct BlemishReachFlippedTests {
    private static let box = CGRect(x: 200, y: 400, width: 600, height: 600)

    /// Both grow by the same amount, and both leave the chin where it was.
    /// Measured from the top left the forehead is reached by taking y *back*,
    /// which is the one line worth a test: adding instead would grow the region
    /// down the neck while the name still said forehead.
    @Test("Flipping the coordinates does not flip which end grows")
    func theForeheadIsStillTheEndThatGrows() {
        let upright = BlemishDetector.fullFace(Self.box)
        let flipped = BlemishDetector.fullFaceFromTopLeft(Self.box)

        #expect(upright.height == flipped.height)
        #expect(upright.width == flipped.width)
        #expect(upright.minX == flipped.minX)

        // Upright: the chin is the bottom and stays put.
        #expect(upright.minY == Self.box.minY)
        // From the top left: the chin is the bottom and stays put too, so it is
        // the top that moves.
        #expect(abs(flipped.maxY - Self.box.maxY) < 1e-9)
        #expect(flipped.minY < Self.box.minY)
    }

    @Test("The two describe the same distance either side of the box")
    func theyGrowByTheSameAmount() {
        let grown = BlemishDetector.fullFace(Self.box).height - Self.box.height
        let flipped = BlemishDetector.fullFaceFromTopLeft(Self.box)
        #expect(abs((Self.box.minY - flipped.minY) - grown) < 1e-9)
    }
}
