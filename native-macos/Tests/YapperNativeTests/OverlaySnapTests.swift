import Foundation
import Testing
@testable import YapperNative

struct OverlaySnapTests {
    private let stage = CGSize(width: 1_000, height: 1_000)

    private func overlay(x: Double, y: Double, width: Double, height: Double) -> ProjectOverlay {
        ProjectOverlay(
            mediaID: UUID(),
            timelineStart: 0,
            duration: 1,
            x: x,
            y: y,
            width: width,
            height: height
        )
    }

    // MARK: - The engine

    @Test func leadingEdgeSettlesOntoTheFrameEdge() {
        // The box's left edge is 5pt off the frame's, inside the 9pt pull.
        let snapped = OverlaySnapEngine.snap(origin: 0.005, extent: 0.3, span: 1_000)
        #expect(snapped.origin == 0)
        #expect(snapped.guide == 0)
    }

    @Test func trailingEdgeSettlesOntoTheFarFrameEdge() {
        // Right edge at 0.994, 6pt short of 1.
        let snapped = OverlaySnapEngine.snap(origin: 0.694, extent: 0.3, span: 1_000)
        #expect(snapped.origin == 0.7)
        #expect(snapped.guide == 1)
    }

    @Test func centreSettlesOntoTheCentreLine() {
        // Centre at 0.496, 4pt left of the middle.
        let snapped = OverlaySnapEngine.snap(origin: 0.346, extent: 0.3, span: 1_000)
        #expect(snapped.origin == 0.35)
        #expect(snapped.guide == 0.5)
    }

    @Test func centreSettlesOntoAThird() {
        let snapped = OverlaySnapEngine.snap(origin: 1.0 / 3.0 - 0.15 + 0.004, extent: 0.3, span: 1_000)
        #expect(snapped.guide == 1.0 / 3.0)
    }

    @Test func theNearestLineWinsWhenTwoAreInReach() {
        // A box 0.02 wide sitting so its left edge is 7pt from the centre line
        // and its centre is 2pt from it. The centre is nearer, so it takes it.
        let snapped = OverlaySnapEngine.snap(origin: 0.493, extent: 0.02, span: 1_000)
        #expect(snapped.origin == 0.49)
        #expect(snapped.guide == 0.5)
    }

    @Test func nothingInReachIsLeftExactlyWhereItWas() {
        let snapped = OverlaySnapEngine.snap(origin: 0.22, extent: 0.3, span: 1_000)
        #expect(snapped.origin == 0.22)
        #expect(snapped.guide == nil)
    }

    @Test func thePullIsMeasuredInPointsSoItScalesWithTheStage() {
        // The same box, the same fraction of the frame, on two sizes of player.
        // On a 100pt stage its trailing edge is under 2pt from the first third
        // and settles; on a 1000pt stage nothing is within 9pt of anything.
        let small = OverlaySnapEngine.snap(origin: 0.05, extent: 0.3, span: 100)
        #expect(small.guide == 1.0 / 3.0)
        let wide = OverlaySnapEngine.snap(origin: 0.05, extent: 0.3, span: 1_000)
        #expect(wide.guide == nil)
        #expect(wide.origin == 0.05)
    }

    // MARK: - Through a drag

    @Test func draggingAnOverlayToTheCentreReportsBothLines() {
        let start = overlay(x: 0.1, y: 0.1, width: 0.4, height: 0.4)
        let moved = OverlayCanvasGeometry.moved(
            overlay: start,
            origin: CGPoint(x: 0.1, y: 0.1),
            // Lands the box's centre 4pt short of the frame's on both axes.
            translation: CGSize(width: 196, height: 196),
            canvasSize: stage
        )
        #expect(moved.overlay.x == 0.3)
        #expect(moved.overlay.y == 0.3)
        #expect(moved.guides.contains(CanvasGuide(axis: .vertical, position: 0.5)))
        #expect(moved.guides.contains(CanvasGuide(axis: .horizontal, position: 0.5)))
    }

    @Test func draggingAnOverlayIntoACornerSettlesOnBothEdges() {
        let start = overlay(x: 0.2, y: 0.2, width: 0.3, height: 0.3)
        let moved = OverlayCanvasGeometry.moved(
            overlay: start,
            origin: CGPoint(x: 0.2, y: 0.2),
            translation: CGSize(width: -195, height: -195),
            canvasSize: stage
        )
        #expect(moved.overlay.x == 0)
        #expect(moved.overlay.y == 0)
        #expect(moved.guides.contains(CanvasGuide(axis: .vertical, position: 0)))
        #expect(moved.guides.contains(CanvasGuide(axis: .horizontal, position: 0)))
    }

    // MARK: - Settling the picture rather than the box

    /// A 2:1 graphic in a square box on a square stage: the picture fills the
    /// width and half the height, centred, so a band above it and a band below
    /// show nothing at all. Those bands are what the guides must ignore.
    @Test func aLetterboxedOverlaySettlesOnWhatYouCanSee() {
        let start = overlay(x: 0.2, y: 0.2, width: 0.4, height: 0.4)
        // Puts the picture's top edge 3pt short of the frame's first third.
        let translation = CGSize(width: 0, height: 30)
        let moved = OverlayCanvasGeometry.moved(
            overlay: start,
            origin: CGPoint(x: 0.2, y: 0.2),
            translation: translation,
            canvasSize: stage,
            shownAspect: 2
        )
        // Settled by its picture: the box sits a band's height above the line.
        let band = (0.4 - 0.2) / 2
        #expect(abs(moved.overlay.y - (1.0 / 3.0 - band)) < 1e-9)
        #expect(moved.guides.contains(CanvasGuide(axis: .horizontal, position: 1.0 / 3.0)))

        // And the same drag with the shape unknown settles on nothing: the
        // box's own edges are nowhere near a line, which is exactly the miss
        // this fixes.
        let byTheBox = OverlayCanvasGeometry.moved(
            overlay: start,
            origin: CGPoint(x: 0.2, y: 0.2),
            translation: translation,
            canvasSize: stage
        )
        #expect(byTheBox.guides.isEmpty)
    }

    @Test func aLetterboxedOverlayStillCentresOnTheCentre() {
        // Fitting keeps the middle where it was, so the centre is the one line
        // that means the same thing to the box and to the picture.
        let start = overlay(x: 0.2, y: 0.2, width: 0.4, height: 0.4)
        let moved = OverlayCanvasGeometry.moved(
            overlay: start,
            origin: CGPoint(x: 0.2, y: 0.2),
            translation: CGSize(width: 96, height: 96),
            canvasSize: stage,
            shownAspect: 2
        )
        #expect(abs(moved.overlay.x - 0.3) < 1e-9)
        #expect(abs(moved.overlay.y - 0.3) < 1e-9)
        #expect(moved.guides.contains(CanvasGuide(axis: .vertical, position: 0.5)))
        #expect(moved.guides.contains(CanvasGuide(axis: .horizontal, position: 0.5)))
    }

    @Test func snappingOffLeavesTheOverlayWhereThePointerPutIt() {
        let start = overlay(x: 0.1, y: 0.1, width: 0.4, height: 0.4)
        let moved = OverlayCanvasGeometry.moved(
            overlay: start,
            origin: CGPoint(x: 0.1, y: 0.1),
            translation: CGSize(width: 196, height: 196),
            canvasSize: stage,
            snapping: false
        )
        #expect(abs(moved.overlay.x - 0.296) < 1e-9)
        #expect(moved.guides.isEmpty)
    }

    @Test func anOverlayWiderThanTheFrameDrawsNoLineItCannotHonour() {
        // Wider than the frame, so it is centred whatever the drag asks for.
        // A guide here would promise an alignment that was overruled.
        let start = overlay(x: 0, y: 0.3, width: 1.4, height: 0.3)
        let moved = OverlayCanvasGeometry.moved(
            overlay: start,
            origin: CGPoint(x: 0, y: 0.3),
            translation: CGSize(width: 2, height: 0),
            canvasSize: stage
        )
        #expect(moved.overlay.x == (1 - 1.4) / 2)
        #expect(!moved.guides.contains { $0.axis == .vertical })
    }
}
