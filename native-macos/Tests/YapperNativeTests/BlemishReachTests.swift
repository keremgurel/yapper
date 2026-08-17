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
