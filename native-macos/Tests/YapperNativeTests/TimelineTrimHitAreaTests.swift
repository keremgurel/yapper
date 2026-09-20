import CoreGraphics
import Testing
@testable import YapperNative

struct TimelineTrimHitAreaTests {
    @Test("Short clips keep their center and most of their body available for moving",
          arguments: [1.0, 2, 10, 20, 28, 40, 56, 100, 1_000])
    func preservesMoveTarget(cellWidth: Double) {
        let edgeWidth = TimelineTrimHitArea.width(for: cellWidth)
        let moveWidth = cellWidth - 2 * edgeWidth

        #expect(edgeWidth > 0)
        #expect(edgeWidth <= 6)
        #expect(moveWidth >= cellWidth * 0.7)
        #expect(edgeWidth < cellWidth / 2)
    }

    @Test("Grabbing inside the old overlapping trim regions now leaves room to move")
    func formerlyOverlappingTargets() {
        let cellWidth = 40.0
        let edgeWidth = TimelineTrimHitArea.width(for: cellWidth)
        for pointerX in [8.0, 16, 20, 24, 32] {
            #expect(pointerX > edgeWidth)
            #expect(pointerX < cellWidth - edgeWidth)
        }
    }
}
