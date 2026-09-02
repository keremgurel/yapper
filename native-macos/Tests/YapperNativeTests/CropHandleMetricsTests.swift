import CoreGraphics
import Testing
@testable import YapperNative

@Suite("Crop handle acquisition")
struct CropHandleMetricsTests {
    @Test("Large crops use a generous corner target")
    func largeCropTarget() {
        #expect(CropHandleMetrics.targetLength(for: 800) == 56)
    }

    @Test("Small crops retain a minimum 44-point corner target")
    func smallCropTarget() {
        #expect(CropHandleMetrics.targetLength(for: 60) == 44)
        #expect(CropHandleMetrics.targetLength(for: 1) == 44)
    }

    @Test("The visible grip leaves room for an invisible acquisition area")
    func gripIsSmallerThanTarget() {
        #expect(CropHandleMetrics.gripSide == 18)
        #expect(CropHandleMetrics.gripSide < CropHandleMetrics.minimumTargetSide)
    }

    @Test("Every enlarged corner region resolves to the correct resize")
    func classifiesAllCorners() {
        let size = CGSize(width: 300, height: 180)

        #expect(name(of: CropHandleMetrics.corner(at: CGPoint(x: 40, y: 40), cropSize: size)) == "top left")
        #expect(name(of: CropHandleMetrics.corner(at: CGPoint(x: 260, y: 40), cropSize: size)) == "top right")
        #expect(name(of: CropHandleMetrics.corner(at: CGPoint(x: 40, y: 140), cropSize: size)) == "bottom left")
        #expect(name(of: CropHandleMetrics.corner(at: CGPoint(x: 260, y: 140), cropSize: size)) == "bottom right")
        #expect(CropHandleMetrics.corner(at: CGPoint(x: 150, y: 90), cropSize: size) == nil)
    }

    @Test("Overlapping targets on a tiny crop choose the nearest corner")
    func tinyCropChoosesNearestCorner() {
        let size = CGSize(width: 60, height: 60)

        #expect(name(of: CropHandleMetrics.corner(at: CGPoint(x: 20, y: 45), cropSize: size)) == "bottom left")
        #expect(name(of: CropHandleMetrics.corner(at: CGPoint(x: 45, y: 45), cropSize: size)) == "bottom right")
    }

    private func name(of corner: CanvasResizeCorner?) -> String? {
        corner?.accessibilityName
    }
}
