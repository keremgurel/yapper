import Foundation

/// When an overlaid layer is on screen during the export, expressed as opacity
/// keyframes over the whole composition.
///
/// Core Animation interpolates linearly between keyframes, so the window has to
/// be closed at both ends. A run that ends at 1 and is left there would not
/// switch the layer off at all: it would fade it out across every second that
/// follows, which is what put four caption cards on screen at once.
enum LayerVisibilityKeyframes {
    struct Track: Equatable {
        var values: [Double]
        var keyTimes: [Double]
    }

    static func make(
        start: Double,
        layerDuration: Double,
        compositionDuration: Double
    ) -> Track {
        guard compositionDuration > 0 else {
            return Track(values: [0, 0], keyTimes: [0, 1])
        }
        // A frame either side of each edge: long enough for the switch to be
        // exact, short enough that no frame catches the layer half-lit.
        let step = min(0.001, max(0.000_001, 1 / max(1, compositionDuration * 120)))
        let begin = clamp(start / compositionDuration)
        let end = max(begin, clamp((start + layerDuration) / compositionDuration))

        var values: [Double] = []
        var keyTimes: [Double] = []

        /// Key times have to rise, so a point landing on the one before it is
        /// dropped rather than flattening the window it belongs to.
        func add(_ value: Double, at time: Double) {
            let time = clamp(time)
            if let last = keyTimes.last, time <= last { return }
            values.append(value)
            keyTimes.append(time)
        }

        if begin > 0 {
            add(0, at: 0)
            add(0, at: begin - step)
            add(1, at: begin)
        } else {
            // On screen from the first frame: no dark run to come out of.
            add(1, at: 0)
        }

        if end < 1 {
            add(1, at: end)
            add(0, at: end + step)
            add(0, at: 1)
        } else {
            // On screen to the last frame, so it never switches off.
            add(1, at: 1)
        }

        return Track(values: values, keyTimes: keyTimes)
    }

    private static func clamp(_ value: Double) -> Double {
        min(1, max(0, value))
    }
}
