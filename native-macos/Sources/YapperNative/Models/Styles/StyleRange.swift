import Foundation

/// The part of the video a template is asked to cover, in the take's own
/// seconds: everything, or from one phrase to another.
struct StyleRange: Equatable, Sendable {
    var mediaID: UUID
    var source: ClosedRange<Double>

    /// Resolves the same anchors `editor.overlays.add` takes. With `at` and no
    /// `until`, the stretch runs to the end of the sentence `at` falls in, so
    /// "split screen when I talk about pricing" covers the whole thought.
    static func resolve(
        at: TimelineAnchorInput?,
        until: TimelineAnchorInput?,
        project: EditorProject,
        playhead: Double
    ) throws -> [StyleRange] {
        guard let at else {
            guard until == nil else { throw AppActionError("Send where the stretch starts as well as where it ends.") }
            return wholeVideo(project)
        }
        let start = try TimelineCue.resolve(at, project: project, playhead: playhead)
        let end = try until.map {
            try TimelineCue.resolveEnd($0, after: start, project: project, playhead: playhead)
        } ?? sentenceEnd(after: start, in: project)
        guard end - start >= 0.5 else { throw AppActionError("That stretch is under half a second. Choose a later end.") }
        guard
            let first = project.sourceLocation(atTimeline: start),
            let last = project.sourceLocation(atTimeline: end - 0.001)
        else { throw AppActionError("Choose a stretch inside the video.") }
        guard first.mediaID == last.mediaID else {
            throw AppActionError("That stretch runs across two recordings. Choose one that stays in one take.")
        }
        guard last.source > first.source else {
            throw AppActionError("The clips there are out of their recorded order. Choose a shorter stretch.")
        }
        return [StyleRange(mediaID: first.mediaID, source: first.source ... last.source)]
    }

    /// Every take on the main track, from the first second used to the last.
    static func wholeVideo(_ project: EditorProject) -> [StyleRange] {
        var ranges: [UUID: ClosedRange<Double>] = [:]
        var order: [UUID] = []
        for clip in project.clips where project.media(for: clip)?.isImage == false {
            if let known = ranges[clip.mediaID] {
                ranges[clip.mediaID] = min(known.lowerBound, clip.sourceStart) ... max(known.upperBound, clip.sourceEnd)
            } else {
                ranges[clip.mediaID] = clip.sourceStart ... clip.sourceEnd
                order.append(clip.mediaID)
            }
        }
        return order.compactMap { id in ranges[id].map { StyleRange(mediaID: id, source: $0) } }
    }

    /// The sentence being spoken at `time`, on the timeline: from the word
    /// after the previous full stop to the next one. `nil` without a
    /// transcript there.
    static func sentence(at time: Double, in project: EditorProject) -> ClosedRange<Double>? {
        let words = TimelineCue.words(in: project)
        let enders: Set<Character> = [".", "?", "!"]
        let endsSentence = { (word: TimelineCueWord) in word.text.last.map(enders.contains) == true }
        guard let current = words.lastIndex(where: { $0.time <= time }) ?? words.indices.first else { return nil }
        var first = current
        while first > 0, !endsSentence(words[first - 1]) { first -= 1 }
        var last = current
        while last < words.count - 1, !endsSentence(words[last]) { last += 1 }
        guard words[last].end > words[first].time else { return nil }
        return words[first].time ... words[last].end
    }

    /// Where the sentence holding `time` ends, or a few seconds on when the
    /// transcript has no full stop there.
    static func sentenceEnd(after time: Double, in project: EditorProject) -> Double {
        let words = TimelineCue.words(in: project)
        let enders: Set<Character> = [".", "?", "!"]
        if let last = words.first(where: { $0.end > time && $0.text.last.map(enders.contains) == true }) {
            return last.end
        }
        let duration = project.clips.reduce(0) { $0 + $1.duration }
        return min(duration, time + 5)
    }
}
