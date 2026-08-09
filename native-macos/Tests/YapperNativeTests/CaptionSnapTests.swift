import Foundation
import Testing
@testable import YapperNative

struct CaptionSnapTests {
    private let stage = CGSize(width: 1_000, height: 1_000)

    @Test func captionSettlesOntoCentreAndReportsBothGuides() {
        // 4pt away on each axis, inside the 9pt pull.
        let snapped = CaptionSnapEngine.snap(x: 0.504, y: 0.496, canvasSize: stage)
        #expect(snapped.x == 0.5)
        #expect(snapped.y == 0.5)
        #expect(snapped.guides.contains(CanvasGuide(axis: .vertical, position: 0.5)))
        #expect(snapped.guides.contains(CanvasGuide(axis: .horizontal, position: 0.5)))
    }

    @Test func captionOutsideThePullKeepsItsExactPositionAndShowsNoGuides() {
        let snapped = CaptionSnapEngine.snap(x: 0.4, y: 0.2, canvasSize: stage)
        #expect(snapped.x == 0.4)
        #expect(snapped.y == 0.2)
        #expect(snapped.guides.isEmpty)
    }

    @Test func snappingCanBeBypassed() {
        let snapped = CaptionSnapEngine.snap(x: 0.501, y: 0.501, canvasSize: stage, enabled: false)
        #expect(snapped.x == 0.501)
        #expect(snapped.y == 0.501)
        #expect(snapped.guides.isEmpty)
    }

    @Test func oneAxisCanSettleWhileTheOtherStaysFree() {
        let snapped = CaptionSnapEngine.snap(x: 0.5, y: 0.2, canvasSize: stage)
        #expect(snapped.x == 0.5)
        #expect(snapped.y == 0.2)
        #expect(snapped.guides == [CanvasGuide(axis: .vertical, position: 0.5)])
    }

    @Test func theDefaultCaptionLineIsSnappable() {
        // Dragging back toward where captions start has to land exactly there.
        let snapped = CaptionSnapEngine.snap(x: 0.2, y: 0.826, canvasSize: stage)
        #expect(snapped.y == TextStyle.default.y)
    }

    @Test func thePullIsConstantInPointsNotStageFractions() {
        // The same fractional offset settles on a short stage and not on a tall
        // one, because the threshold is a distance on screen.
        let short = CaptionSnapEngine.snap(x: 0.5, y: 0.52, canvasSize: CGSize(width: 400, height: 400))
        let tall = CaptionSnapEngine.snap(x: 0.5, y: 0.52, canvasSize: CGSize(width: 400, height: 2_000))
        #expect(short.y == 0.5)
        #expect(tall.y == 0.52)
    }
}
