import Foundation

/// Finds a quoted part of the speech in the cut as it stands.
///
/// A word counts as kept when its midpoint is inside a clip, which is what
/// `TimelineCue.words` reports. A phrase is more forgiving at its two ends: a
/// cut placed a few milliseconds into the first or last word still leaves that
/// word audible, and a quote like "I'll send you the link" must not fail
/// because the cut landed at 266.62 inside "link" (266.51 to 266.75). So the
/// first word may have lost its start and the last word may have lost its end,
/// as long as a real part of it survives. Every word in between has to be kept
/// outright, so a retake that was cut away cannot match through a sliver of
/// its last word.
enum TimelinePhrase {
    struct Match: Equatable {
        /// Timeline seconds where the first word starts, or where its kept
        /// part does.
        let start: Double
        /// Timeline seconds where the last word ends, or where its kept part
        /// does.
        let end: Double
    }

    /// The share of a word that has to survive a cut for it to finish or open
    /// a phrase. Under a quarter is a sliver, not a word you can hear.
    static let minimumEdgeShare = 0.25
    /// Two words further apart than this on the timeline are not one phrase.
    static let maximumGap = 1.2

    static func matches(_ phrase: String, in project: EditorProject) -> [Match] {
        let wanted = TimelineCue.tokens(phrase)
        guard !wanted.isEmpty else { return [] }
        let parts = spokenTokens(in: project)
        guard parts.count >= wanted.count else { return [] }
        var matches: [Match] = []
        for index in 0...(parts.count - wanted.count) {
            let run = parts[index..<(index + wanted.count)]
            guard zip(run, wanted).allSatisfy({ $0.text == $1 }),
                  edgesAllowed(Array(run)),
                  zip(run, run.dropFirst()).allSatisfy({ $1.time - $0.end <= maximumGap }),
                  let first = run.first, let last = run.last
            else { continue }
            if matches.last?.start != first.time {
                matches.append(Match(start: first.time, end: last.end))
            }
        }
        return matches
    }

    /// How much of a word the cut left in.
    enum Cut: Equatable {
        /// Midpoint inside the clip: an ordinary kept word.
        case none
        /// The clip starts inside the word: its end is kept.
        case lostStart
        /// The clip ends inside the word: its start is kept.
        case lostEnd
    }

    struct Token: Equatable {
        let text: String
        let time: Double
        let end: Double
        let cut: Cut
    }

    /// A partly kept word may open a phrase only if it lost its start, and
    /// close one only if it lost its end. A one-word phrase may be either.
    private static func edgesAllowed(_ run: [Token]) -> Bool {
        for (offset, token) in run.enumerated() where token.cut != .none {
            let isFirst = offset == 0, isLast = offset == run.count - 1
            switch token.cut {
            case .none: continue
            case .lostStart: if !isFirst { return false }
            case .lostEnd: if !isLast { return false }
            }
        }
        return true
    }

    /// Every token of the speech in timeline order, kept words and partly kept
    /// ones alike. A word kept outright in one clip is never also offered as a
    /// partial from the clip next to it, which is what a plain split leaves.
    static func spokenTokens(in project: EditorProject) -> [Token] {
        let byMedia = Dictionary(grouping: project.transcript ?? [], by: \.mediaID)
            .mapValues { $0.sorted { $0.start < $1.start } }
        let keptWordIDs = Set(project.clips.flatMap { clip in
            (byMedia[clip.mediaID] ?? []).filter { isKept($0, in: clip) }.map(\.id)
        })
        var start = 0.0
        var result: [Token] = []
        for clip in project.clips {
            defer { start += clip.duration }
            for word in byMedia[clip.mediaID] ?? [] {
                let cut: Cut
                if isKept(word, in: clip) {
                    cut = .none
                } else if !keptWordIDs.contains(word.id), let partial = partialCut(word, in: clip) {
                    cut = partial
                } else {
                    continue
                }
                let time = start + clip.timelineOffset(forSource: max(clip.sourceStart, word.start))
                let end = start + clip.timelineOffset(forSource: min(clip.sourceEnd, word.end))
                result += TimelineCue.tokens(word.text).map { Token(text: $0, time: time, end: end, cut: cut) }
            }
        }
        return result
    }

    private static func isKept(_ word: TranscriptWord, in clip: TimelineClip) -> Bool {
        word.midpoint >= clip.sourceStart && word.midpoint < clip.sourceEnd
    }

    private static func partialCut(_ word: TranscriptWord, in clip: TimelineClip) -> Cut? {
        let length = word.end - word.start
        let kept = min(word.end, clip.sourceEnd) - max(word.start, clip.sourceStart)
        guard length > 0, kept > 0, kept >= length * minimumEdgeShare else { return nil }
        if word.start < clip.sourceStart, word.end <= clip.sourceEnd { return .lostStart }
        if word.end > clip.sourceEnd, word.start >= clip.sourceStart { return .lostEnd }
        return nil
    }
}
