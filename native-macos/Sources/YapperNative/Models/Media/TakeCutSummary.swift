import Foundation

/// How much of the footage the timeline keeps, and where: the picture of what
/// an edit did to a take.
///
/// Every file the main track reads from is laid end to end, and each clip is
/// a kept stretch of that line. Everything between the stretches was cut.
struct TakeCutSummary: Equatable, Sendable {
    /// A kept stretch, as fractions of the whole line.
    struct Stretch: Equatable, Sendable {
        let start: Double
        let end: Double
    }

    let sourceDuration: Double
    let keptDuration: Double
    let stretches: [Stretch]

    /// The share of the footage that was cut, from 0 to 1.
    var cutShare: Double {
        guard sourceDuration > 0 else { return 0 }
        return min(1, max(0, 1 - keptDuration / sourceDuration))
    }

    /// True once the timeline keeps noticeably less than it was given. A take
    /// that has only lost a frame at each end has not been edited.
    var isCut: Bool { sourceDuration > 0 && sourceDuration - keptDuration > 0.5 }

    init(clips: [TimelineClip], media: [ProjectMedia]) {
        let lengths = Dictionary(uniqueKeysWithValues: media.filter { !$0.isImage && !$0.isScene }
            .map { ($0.id, max(0, $0.duration)) })
        // Files in the order the timeline first reaches them.
        var order: [UUID] = []
        for clip in clips where lengths[clip.mediaID] != nil && !order.contains(clip.mediaID) {
            order.append(clip.mediaID)
        }
        var offsets: [UUID: Double] = [:]
        var total = 0.0
        for id in order {
            offsets[id] = total
            total += lengths[id] ?? 0
        }
        sourceDuration = total
        guard total > 0 else {
            keptDuration = 0
            stretches = []
            return
        }
        var kept = 0.0
        var found: [Stretch] = []
        for clip in clips {
            guard let offset = offsets[clip.mediaID], let length = lengths[clip.mediaID] else { continue }
            let start = min(length, max(0, clip.sourceStart))
            let end = min(length, max(start, clip.sourceEnd))
            guard end > start else { continue }
            kept += end - start
            found.append(Stretch(start: (offset + start) / total, end: (offset + end) / total))
        }
        // A stretch used twice counts once toward the line's length.
        keptDuration = min(total, kept)
        stretches = found.sorted { $0.start < $1.start }
    }
}
