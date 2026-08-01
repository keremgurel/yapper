import Foundation

enum TimelineMetrics {
    static func x(for time: Double, duration: Double, width: Double) -> Double {
        guard duration > 0, width > 0 else { return 0 }
        return min(width, max(0, time / duration * width))
    }

    static func time(for x: Double, duration: Double, width: Double) -> Double {
        guard duration > 0, width > 0 else { return 0 }
        return min(duration, max(0, x / width * duration))
    }
}
