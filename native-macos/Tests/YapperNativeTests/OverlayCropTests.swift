import CoreGraphics
import Foundation
import Testing
@testable import YapperNative

struct OverlayCropTests {
    @Test func aFreshCropKeepsTheWholePicture() {
        #expect(OverlayCrop.full.isFull)
        #expect(!OverlayCrop(x: 0, y: 0, width: 0.5, height: 1).isFull)
    }

    @Test func aCropIsHeldInsideTheMedia() {
        let crop = OverlayCrop(x: 0.8, y: -0.3, width: 0.5, height: 0.5).clamped
        #expect(crop.x == 0.5)
        #expect(crop.y == 0)
        #expect(crop.width == 0.5)
    }

    @Test func aCropCannotBeShrunkToNothing() {
        let crop = OverlayCrop(x: 0.2, y: 0.2, width: 0.001, height: 0.001).clamped
        #expect(crop.width == OverlayCrop.minimumSide)
        #expect(crop.height == OverlayCrop.minimumSide)
    }

    @Test func draggingACornerLeavesTheOppositeOneAlone() {
        let crop = OverlayCrop(x: 0.2, y: 0.2, width: 0.6, height: 0.6)
        let resized = crop.resized(corner: .topLeading, dx: 0.1, dy: 0.1)
        #expect(abs(resized.x - 0.3) < 0.0001)
        #expect(abs(resized.y - 0.3) < 0.0001)
        // The bottom right stayed at 0.8, 0.8.
        #expect(abs(resized.x + resized.width - 0.8) < 0.0001)
        #expect(abs(resized.y + resized.height - 0.8) < 0.0001)
    }

    @Test func croppingChangesTheShapeAnOverlayIsGiven() {
        // Half the width of a 16:9 picture is 8:9.
        let aspect = OverlayFrame.shownAspect(
            mediaAspect: 16.0 / 9.0,
            crop: OverlayCrop(x: 0, y: 0, width: 0.5, height: 1)
        )
        #expect(abs(aspect - 8.0 / 9.0) < 0.0001)
    }

    @Test func anUncroppedPictureJustFillsItsBox() {
        let placement = OverlayCrop.full.mediaPlacement(mediaAspect: 1, boxAspect: 1)
        #expect(placement.x == 0)
        #expect(placement.y == 0)
        #expect(placement.width == 1)
        #expect(placement.height == 1)
    }

    @Test func theKeptRectangleCoversTheBoxExactly() {
        // The right half of a square picture, in a box of the same shape as
        // that half: the picture is drawn at twice the box's width and slid
        // left so its right half lands on the box.
        let crop = OverlayCrop(x: 0.5, y: 0, width: 0.5, height: 1)
        let placement = crop.mediaPlacement(mediaAspect: 1, boxAspect: 0.5)
        #expect(abs(placement.width - 2) < 0.0001)
        #expect(abs(placement.height - 1) < 0.0001)
        #expect(abs(placement.x + 1) < 0.0001)
        #expect(placement.y == 0)
    }

    @Test func theSourceRectangleIsMeasuredFromTheBottomLeft() {
        let crop = OverlayCrop(x: 0.25, y: 0, width: 0.5, height: 0.5)
        let rect = crop.sourceRect(inPixelSize: CGSize(width: 400, height: 200))
        #expect(rect.minX == 100)
        // The top half of the picture is the upper 100pt of a 200pt frame.
        #expect(rect.minY == 100)
        #expect(rect.width == 200)
        #expect(rect.height == 100)
    }
}
