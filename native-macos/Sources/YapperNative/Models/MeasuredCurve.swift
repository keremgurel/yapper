import Foundation

/// A quantity read off a handful of measurements, in straight lines between
/// them.
///
/// Below the first measurement the first line carries on downward, because a
/// smaller job is a quicker one. Above the last it stays level: the last point
/// is where the thing being measured stops growing.
struct MeasuredCurve: Equatable, Sendable {
    struct Point: Equatable, Sendable {
        var x: Double
        var y: Double
    }

    /// In ascending `x`. At least two.
    var points: [Point]

    func value(at x: Double) -> Double {
        guard let last = points.last else { return 0 }
        guard points.count > 1, x < last.x else { return last.y }
        // The first point at or past `x`, never the very first one, so a value
        // below every measurement is read off the first line.
        let upper = points.dropFirst().firstIndex { x <= $0.x } ?? points.count - 1
        return Self.line(from: points[upper - 1], to: points[upper], at: x)
    }

    private static func line(from a: Point, to b: Point, at x: Double) -> Double {
        guard b.x > a.x else { return a.y }
        return a.y + (b.y - a.y) * (x - a.x) / (b.x - a.x)
    }
}
