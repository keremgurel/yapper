import CoreGraphics
import Foundation
import Testing
@testable import YapperNative

struct OverlayCanvasGeometryTests {
    private let stage = CGSize(width: 1_000, height: 1_000)

    private func card(
        x: Double = 0.5,
        y: Double = 0.5,
        width: Double = 0.2,
        height: Double = 0.2
    ) -> ProjectOverlay {
        ProjectOverlay(
            mediaID: UUID(),
            timelineStart: 0,
            duration: 2,
            x: x,
            y: y,
            width: width,
            height: height
        )
    }

    @Test func draggingMovesTheOverlayByTheTravelledDistance() {
        let moved = OverlayCanvasGeometry.moved(
            overlay: card(x: 0.1, y: 0.1),
            origin: CGPoint(x: 0.1, y: 0.1),
            translation: CGSize(width: 200, height: 100),
            canvasSize: stage,
            snapping: false
        )
        #expect(abs(moved.overlay.x - 0.3) < 0.0001)
        #expect(abs(moved.overlay.y - 0.2) < 0.0001)
        #expect(moved.guides.isEmpty)
    }

    @Test func anOverlayNearTheMiddleSettlesOntoItAndReportsBothLines() {
        // Its centre is 4pt from each centre line, inside the 9pt pull.
        let moved = OverlayCanvasGeometry.moved(
            overlay: card(x: 0.404, y: 0.404),
            origin: CGPoint(x: 0.404, y: 0.404),
            translation: .zero,
            canvasSize: stage
        )
        #expect(abs(moved.overlay.x - 0.4) < 0.0001)
        #expect(abs(moved.overlay.y - 0.4) < 0.0001)
        #expect(moved.guides.count == 2)
    }

    /// Running a card off the edge is a real composition. What is not is
    /// losing one: a tenth of the frame stays covered, whatever the drag says.
    @Test func anOverlayCanBeDraggedOffTheFrameButNotAwayEntirely() {
        let moved = OverlayCanvasGeometry.moved(
            overlay: card(x: 0.7, y: 0.7),
            origin: CGPoint(x: 0.7, y: 0.7),
            translation: CGSize(width: 900, height: 900),
            canvasSize: stage,
            snapping: false
        )
        #expect(moved.overlay.x > 0.8)
        #expect(abs(moved.overlay.x - 0.9) < 0.0001)
        #expect(abs(moved.overlay.y - 0.9) < 0.0001)
    }

    @Test func anOverlayCanBeDraggedPastTheTopEdge() {
        let moved = OverlayCanvasGeometry.moved(
            overlay: card(x: 0.2, y: 0.05, width: 0.4, height: 0.2),
            origin: CGPoint(x: 0.2, y: 0.05),
            translation: CGSize(width: 0, height: -60),
            canvasSize: stage,
            snapping: false
        )
        #expect(moved.overlay.y < 0)
    }

    /// The rule that centred these made them the one kind of overlay nobody
    /// could move: every drag put it straight back in the middle.
    @Test func anOverlayBiggerThanTheFrameStillFollowsTheHand() {
        let moved = OverlayCanvasGeometry.moved(
            overlay: card(width: 1.2, height: 1.2),
            origin: CGPoint(x: 0, y: 0),
            translation: CGSize(width: 300, height: 0),
            canvasSize: stage,
            snapping: false
        )
        #expect(moved.overlay.x > 0)
    }

    @Test func resizingKeepsTheMediaShapeAndTheOppositeCorner() {
        let overlay = card(x: 0.2, y: 0.2, width: 0.4, height: 0.2)
        let resized = OverlayCanvasGeometry.resized(
            overlay: overlay,
            translation: CGSize(width: -80, height: -40),
            corner: .topLeading,
            canvasSize: stage,
            mediaAspect: 2,
            frameAspect: 1
        )
        // Dragging the top left away from the box grows it.
        #expect(resized.width > overlay.width)
        // A 2:1 media on a square frame is always half as tall as it is wide.
        #expect(abs(resized.height - resized.width / 2) < 0.0001)
        // The bottom right corner has not moved.
        #expect(abs((resized.x + resized.width) - (overlay.x + overlay.width)) < 0.0001)
        #expect(abs((resized.y + resized.height) - (overlay.y + overlay.height)) < 0.0001)
    }

    @Test func resizingFromTheBottomRightLeavesTheOriginAlone() {
        let overlay = card(x: 0.1, y: 0.1, width: 0.3, height: 0.3)
        let resized = OverlayCanvasGeometry.resized(
            overlay: overlay,
            translation: CGSize(width: 60, height: 60),
            corner: .bottomTrailing,
            canvasSize: stage,
            mediaAspect: 1,
            frameAspect: 1
        )
        #expect(resized.x == overlay.x)
        #expect(resized.y == overlay.y)
        #expect(resized.width > overlay.width)
    }

    @Test func aResizeCannotShrinkPastTheMinimumOrGrowPastTheMaximum() {
        let overlay = card(width: 0.1, height: 0.1)
        let shrunk = OverlayCanvasGeometry.resized(
            overlay: overlay,
            translation: CGSize(width: -5_000, height: -5_000),
            corner: .bottomTrailing,
            canvasSize: stage,
            mediaAspect: 1,
            frameAspect: 1
        )
        #expect(shrunk.width == OverlayCanvasGeometry.minimumWidth)

        let grown = OverlayCanvasGeometry.resized(
            overlay: overlay,
            translation: CGSize(width: 9_000, height: 9_000),
            corner: .bottomTrailing,
            canvasSize: stage,
            mediaAspect: 1,
            frameAspect: 1
        )
        #expect(grown.width == OverlayCanvasGeometry.maximumWidth)
    }

    @Test func scalingKeepsTheOverlayCentredWhereItWas() {
        let overlay = card(x: 0.3, y: 0.3, width: 0.4, height: 0.4)
        let scaled = OverlayCanvasGeometry.scaled(
            overlay: overlay,
            toWidth: 0.2,
            mediaAspect: 1,
            frameAspect: 1
        )
        #expect(abs(scaled.x + scaled.width / 2 - (overlay.x + overlay.width / 2)) < 0.0001)
        #expect(abs(scaled.y + scaled.height / 2 - (overlay.y + overlay.height / 2)) < 0.0001)
    }

    @Test func fillingTheFrameReadsAsAFullFrameOverlay() {
        #expect(OverlayFrame.isFullFrame(OverlayCanvasGeometry.filling(overlay: card())))
    }
}
