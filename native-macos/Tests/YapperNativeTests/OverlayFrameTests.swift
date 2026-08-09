import CoreGraphics
import Foundation
import Testing
@testable import YapperNative

struct OverlayFrameTests {
    private let portrait = CGSize(width: 1_080, height: 1_920)

    @Test func boxIsMeasuredFromTheTopLeft() {
        let overlay = ProjectOverlay(
            mediaID: UUID(),
            timelineStart: 0,
            duration: 2,
            x: 0.5,
            y: 0.25,
            width: 0.5,
            height: 0.25
        )
        let box = OverlayFrame.box(overlay, in: portrait)
        #expect(box.minX == 540)
        #expect(box.minY == 480)
        #expect(box.width == 540)
        #expect(box.height == 480)
    }

    @Test func aWideImageInASquareBoxKeepsItsShapeAndStaysCentred() {
        let fitted = OverlayFrame.fitted(
            CGRect(x: 100, y: 100, width: 400, height: 400),
            mediaAspect: 2
        )
        #expect(fitted.width == 400)
        #expect(fitted.height == 200)
        #expect(fitted.midY == 300)
    }

    @Test func heightFollowsTheMediaShapeAcrossTheFrameShape() {
        // A 16:9 card 50% across a 9:16 frame is 50% * (9/16) / (16/9) tall.
        let height = OverlayFrame.height(
            forWidth: 0.5,
            mediaAspect: 16.0 / 9.0,
            frameAspect: 9.0 / 16.0
        )
        #expect(abs(height - 0.158) < 0.001)
        // Fed back through the pixel box, that is the media's own aspect.
        let box = CGRect(
            x: 0,
            y: 0,
            width: portrait.width * 0.5,
            height: portrait.height * height
        )
        #expect(abs(box.width / box.height - 16.0 / 9.0) < 0.01)
    }

    @Test func mediaCutToTheFrameShapeCoversIt() {
        let box = OverlayFrame.introduced(mediaAspect: 9.0 / 16.0, frameAspect: 9.0 / 16.0)
        #expect(box.x == 0)
        #expect(box.y == 0)
        #expect(box.width == 1)
        #expect(box.height == 1)
    }

    @Test func otherMediaLandsAsACardInTheTopRight() {
        let box = OverlayFrame.introduced(mediaAspect: 16.0 / 9.0, frameAspect: 9.0 / 16.0)
        #expect(box.width < 0.5)
        #expect(box.x + box.width <= 1)
        #expect(box.y > 0)
        #expect(box.height < 0.46)
        // On the media's own shape, so nothing is letterboxed inside the card.
        let pixels = OverlayFrame.box(
            ProjectOverlay(
                mediaID: UUID(),
                timelineStart: 0,
                duration: 1,
                x: box.x,
                y: box.y,
                width: box.width,
                height: box.height
            ),
            in: portrait
        )
        #expect(abs(pixels.width / pixels.height - 16.0 / 9.0) < 0.01)
    }

    @Test func aTallCardIsNarrowedRatherThanAllowedToSwallowTheFrame() {
        let box = OverlayFrame.introduced(mediaAspect: 0.5, frameAspect: 9.0 / 16.0)
        #expect(box.height <= 0.46)
        #expect(box.width < 0.42)
    }

    @Test func onlyAFullFrameOverlayCountsAsOne() {
        var overlay = ProjectOverlay(mediaID: UUID(), timelineStart: 0, duration: 1)
        overlay.x = 0
        overlay.y = 0
        overlay.width = 1
        overlay.height = 1
        #expect(OverlayFrame.isFullFrame(overlay))
        overlay.width = 0.9
        #expect(!OverlayFrame.isFullFrame(overlay))
    }
}
