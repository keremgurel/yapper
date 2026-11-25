@preconcurrency import AVFoundation

/// Whether a composition has sound in part of its timeline.
enum CompositionAudio {
    /// True when an audio track has a non-empty segment overlapping `range`,
    /// or anywhere when `range` is nil.
    static func hasSound(in composition: AVMutableComposition, during range: CMTimeRange?) -> Bool {
        composition.tracks(withMediaType: .audio).contains { track in
            track.segments.contains { segment in
                guard !segment.isEmpty else { return false }
                guard let range else { return true }
                let overlap = CMTimeRangeGetIntersection(segment.timeMapping.target, otherRange: range)
                return overlap.duration > CMTime(value: 1, timescale: 600)
            }
        }
    }
}
