import Foundation

/// Which lane each sound sits on, so two that overlap in time do not overlap on
/// screen.
///
/// The same idea as the overlay lanes and for the same reason: a drum roll
/// three seconds long with a pop landing in the middle of it drew one on top of
/// the other, and the pop was a sliver of a cell you could neither read nor
/// grab.
///
/// Worked out from the sounds themselves rather than stored on them. A lane is
/// not a decision anybody made here — nothing about a sound changes by moving
/// it down a row, unlike an overlay, where the lane decides what covers what.
/// So there is nothing to save, nothing to migrate, and a project made before
/// this existed sorts itself out the moment it is opened.
enum AudioTracks {
    /// Lane per sound, keyed by id. Lane 0 is the row nearest the video track.
    ///
    /// Packed greedily in the order they are heard: each sound takes the lowest
    /// lane that is free when it starts, which keeps a run of sounds that never
    /// overlap on one row and only pushes down what has to go down.
    static func lanes(for layers: [ProjectAudioLayer]) -> [UUID: Int] {
        var freeFrom: [Double] = []
        var lanes: [UUID: Int] = [:]

        for layer in layers.sorted(by: { $0.timelineStart < $1.timelineStart }) {
            let start = layer.timelineStart
            let end = start + max(0, layer.duration)
            // A hair of tolerance: a sound that begins exactly where another
            // ends is not an overlap, and floating point makes that a coin toss.
            let lane = freeFrom.firstIndex { $0 <= start + 0.001 } ?? freeFrom.count
            if lane < freeFrom.count {
                freeFrom[lane] = end
            } else {
                freeFrom.append(end)
            }
            lanes[layer.id] = lane
        }
        return lanes
    }

    /// How many lanes those sounds need.
    static func count(for layers: [ProjectAudioLayer]) -> Int {
        guard !layers.isEmpty else { return 0 }
        return (lanes(for: layers).values.max() ?? 0) + 1
    }
}
