import CoreGraphics
import Testing
@testable import YapperNative

@Suite("Crop interaction acquisition")
struct CropHandleMetricsTests {
    @Test("Large crops use a dependable corner target")
    func largeCropTarget() {
        #expect(CropHandleMetrics.cornerTarget(for: 800) == 36)
    }

    @Test("Small crops preserve a central movement region")
    func smallCropPreservesMovement() {
        #expect(CropHandleMetrics.cornerTarget(for: 60) == 20)
        #expect(CropHandleMetrics.intent(at: CGPoint(x: 30, y: 30), cropSize: CGSize(width: 60, height: 60)) == .move)
    }

    @Test("Every corner region resolves to the correct resize")
    func classifiesAllCorners() {
        let size = CGSize(width: 300, height: 180)

        #expect(CropHandleMetrics.intent(at: CGPoint(x: 24, y: 24), cropSize: size) == .corner(.topLeading))
        #expect(CropHandleMetrics.intent(at: CGPoint(x: 276, y: 24), cropSize: size) == .corner(.topTrailing))
        #expect(CropHandleMetrics.intent(at: CGPoint(x: 24, y: 156), cropSize: size) == .corner(.bottomLeading))
        #expect(CropHandleMetrics.intent(at: CGPoint(x: 276, y: 156), cropSize: size) == .corner(.bottomTrailing))
    }

    @Test("Sides resize without stealing the centre")
    func classifiesEdgesAndMovement() {
        let size = CGSize(width: 300, height: 180)

        #expect(CropHandleMetrics.intent(at: CGPoint(x: 150, y: 8), cropSize: size) == .edge(.top))
        #expect(CropHandleMetrics.intent(at: CGPoint(x: 150, y: 172), cropSize: size) == .edge(.bottom))
        #expect(CropHandleMetrics.intent(at: CGPoint(x: 8, y: 90), cropSize: size) == .edge(.leading))
        #expect(CropHandleMetrics.intent(at: CGPoint(x: 292, y: 90), cropSize: size) == .edge(.trailing))
        #expect(CropHandleMetrics.intent(at: CGPoint(x: 150, y: 90), cropSize: size) == .move)
    }

    @Test("Bottom controls can be acquired just outside the selection")
    func bottomOutsideTolerance() {
        let size = CGSize(width: 300, height: 180)

        #expect(CropHandleMetrics.intent(at: CGPoint(x: 150, y: 186), cropSize: size) == .edge(.bottom))
        #expect(CropHandleMetrics.intent(at: CGPoint(x: 294, y: 186), cropSize: size) == .corner(.bottomTrailing))
        #expect(CropHandleMetrics.intent(at: CGPoint(x: 150, y: 192), cropSize: size) == nil)
    }
}
