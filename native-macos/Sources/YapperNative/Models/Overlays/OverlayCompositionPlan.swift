import Foundation

/// How video overlays are laid out for AVFoundation.
///
/// A cutaway is a second picture on screen at the same time as the speaker,
/// which means a second video track and an instruction that names both. Two
/// overlays that are on screen together cannot share a track, and every instant
/// where something appears or disappears has to start a new instruction.
///
/// All of that is arithmetic, so it lives here rather than inside the builder.
enum OverlayCompositionPlan {
    /// Times closer together than one composition frame are the same time.
    static let epsilon = 1.0 / 600.0

    /// Overlays grouped into tracks, back to front: nothing inside a lane ever
    /// overlaps, and a lane later in the array draws over the ones before it.
    ///
    /// The creator's own lanes come first, lowest to highest, because that is
    /// the order they stack on the timeline. Two overlays sharing a lane and a
    /// moment cannot share a composition track, so the later one is lifted into
    /// a lane of its own above it.
    static func lanes(for overlays: [ProjectOverlay]) -> [[ProjectOverlay]] {
        var lanes: [[ProjectOverlay]] = []
        for overlay in OverlayTracks.backToFront(overlays) where overlay.duration > epsilon {
            let index = lanes.firstIndex { lane in
                guard let last = lane.last else { return true }
                return overlay.timelineStart >= last.timelineStart + last.duration - epsilon
            }
            if let index {
                lanes[index].append(overlay)
            } else {
                lanes.append([overlay])
            }
        }
        return lanes
    }

    /// Every instant where what is on screen changes: a cut on the main track,
    /// or an overlay arriving or leaving. Instructions run from one to the next.
    /// - Parameter keyframes: moments the main track's framing changes
    ///   direction. An instruction can ramp between two transforms and no
    ///   further, so every key has to be a boundary or a push-in that speeds up
    ///   halfway would be flattened into one straight move.
    static func boundaries(
        clipEnds: [Double],
        overlays: [ProjectOverlay],
        duration: Double,
        keyframes: [Double] = []
    ) -> [Double] {
        guard duration > epsilon else { return [] }
        var times: [Double] = [0, duration]
        times.append(contentsOf: clipEnds)
        times.append(contentsOf: keyframes)
        for overlay in overlays where overlay.duration > epsilon {
            times.append(overlay.timelineStart)
            times.append(overlay.timelineStart + overlay.duration)
        }

        var result: [Double] = []
        for time in times.map({ min(duration, max(0, $0)) }).sorted() {
            if let last = result.last, time - last < epsilon { continue }
            result.append(time)
        }
        // The last boundary is the end of the composition, always. It can sit
        // within a rounding of the final clip's end, and dropping it as a
        // duplicate leaves the last instant covered by no instruction at all.
        if let last = result.last, last < duration { result[result.count - 1] = duration }
        // A single boundary describes no interval at all.
        return result.count > 1 ? result : []
    }

    /// The overlay a lane shows across `start ..< end`, if any. An interval
    /// never straddles a boundary, so testing its midpoint is enough.
    static func overlay(
        in lane: [ProjectOverlay],
        from start: Double,
        to end: Double
    ) -> ProjectOverlay? {
        let midpoint = (start + end) / 2
        return lane.first {
            midpoint >= $0.timelineStart && midpoint <= $0.timelineStart + $0.duration
        }
    }
}
