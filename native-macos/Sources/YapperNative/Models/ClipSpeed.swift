import Foundation

enum ClipSpeed {
    static let range = 0.25...4.0
    static let presets: [Double] = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 3, 4]

    static func normalized(_ value: Double?) -> Double {
        guard let value, value.isFinite, range.contains(value) else { return 1 }
        return value
    }

    static func label(_ value: Double) -> String {
        value.formatted(.number.precision(.fractionLength(0...2))) + "×"
    }
}

struct ClipSpeedTimeMap {
    let before: [TimelineClip]
    let after: [TimelineClip]

    func map(_ time: Double) -> Double {
        var oldCursor = 0.0, newCursor = 0.0
        for (old, new) in zip(before, after) {
            if time <= oldCursor + old.duration {
                return newCursor + max(0, time - oldCursor) * old.resolvedPlaybackRate / new.resolvedPlaybackRate
            }
            oldCursor += old.duration
            newCursor += new.duration
        }
        return newCursor + max(0, time - oldCursor)
    }
}

extension EditorProject {
    /// The end of the audible part of a word in the same kept clip as its start.
    func timelineEnd(for word: TranscriptWord) -> Double? {
        var cursor = 0.0
        for clip in clips {
            if clip.mediaID == word.mediaID, word.playbackAnchor >= clip.sourceStart,
               word.playbackAnchor <= clip.sourceEnd {
                return cursor + min(clip.duration, max(0, clip.timelineOffset(forSource: word.end)))
            }
            cursor += clip.duration
        }
        return nil
    }
}
