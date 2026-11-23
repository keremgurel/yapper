import Foundation
import Testing
@testable import YapperNative

struct MeasuredCurveTests {
    private let curve = MeasuredCurve(points: [
        .init(x: 10, y: 100),
        .init(x: 20, y: 200),
        .init(x: 40, y: 220),
    ])

    @Test("a measured point reads back as measured")
    func passesThroughItsPoints() {
        #expect(curve.value(at: 10) == 100)
        #expect(curve.value(at: 20) == 200)
        #expect(curve.value(at: 40) == 220)
    }

    @Test("between two points it reads the straight line")
    func interpolates() {
        #expect(curve.value(at: 15) == 150)
        #expect(curve.value(at: 30) == 210)
    }

    @Test("below the first point the first line carries on")
    func extendsDownward() {
        #expect(curve.value(at: 5) == 50)
    }

    @Test("past the last point it stays level")
    func staysLevel() {
        #expect(curve.value(at: 400) == 220)
    }

    @Test("one point is a constant, and none is zero")
    func degenerateCurves() {
        #expect(MeasuredCurve(points: [.init(x: 3, y: 7)]).value(at: 90) == 7)
        #expect(MeasuredCurve(points: []).value(at: 90) == 0)
    }
}
